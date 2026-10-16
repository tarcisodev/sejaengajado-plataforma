import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { ENV, type Env } from '../../config/env';

export const UPLOAD_ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
/** Presigned upload lifetime — must stay ≤ 5 minutes. */
export const UPLOAD_EXPIRES_SECONDS = 300;

const requestSchema = z.object({
  contentType: z.string().min(1),
  contentLength: z.number().int().positive(),
  filename: z.string().min(1).max(200).optional(),
});

export function buildUploadObjectKey(resellerId: string, contentType: string): string {
  return `resellers/${resellerId}/${randomUUID()}${extFor(contentType)}`;
}

/**
 * Who owns an upload. Drives the object-key prefix (tenant isolation):
 * - reseller: `resellers/<resellerId>/<uuid>.ext`
 * - admin: `admin/<uuid>.ext`
 * - customer: `customers/<userId>/<uuid>.ext`
 */
export type UploadScope =
  | { kind: 'reseller'; resellerId: string }
  | { kind: 'admin' }
  | { kind: 'customer'; userId: string };

/** Object key for a presigned upload, prefixed by its owner scope. */
export function buildScopedUploadKey(scope: UploadScope, contentType: string): string {
  switch (scope.kind) {
    case 'reseller':
      return buildUploadObjectKey(requireId(scope.resellerId), contentType);
    case 'admin':
      return `admin/${randomUUID()}${extFor(contentType)}`;
    case 'customer':
      return `customers/${requireId(scope.userId)}/${randomUUID()}${extFor(contentType)}`;
    default: {
      const exhaustive: never = scope;
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Escopo de upload inválido',
        scope: String(exhaustive),
      });
    }
  }
}

function requireId(id: string | null | undefined): string {
  if (!id || !/^[0-9a-zA-Z-]{1,64}$/.test(id)) {
    throw new BadRequestException({
      code: 'VALIDATION_FAILED',
      message: 'Escopo de upload inválido',
    });
  }
  return id;
}

export function uploadPostConditions(
  contentType: string,
  maxBytes: number,
): Array<['content-length-range', number, number] | ['eq', string, string]> {
  return [
    ['content-length-range', 1, maxBytes],
    ['eq', '$Content-Type', contentType],
  ];
}

@Injectable()
export class UploadService {
  private client: S3Client | null = null;

  constructor(@Inject(ENV) private readonly env: Env) {}

  /**
   * Presigned S3 PUT (JPEG/PNG/WebP, ≤ 5 MB, 5 min).
   * @param scope owner of the upload (reseller / admin / customer).
   */
  async createPresignedUpload(body: unknown, scope: UploadScope) {
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Dados inválidos',
        fields: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          code: issue.code,
          message: issue.message,
        })),
      });
    }

    const { contentType, contentLength } = parsed.data;
    if (!UPLOAD_ALLOWED_TYPES.has(contentType)) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Tipo de arquivo não permitido',
        fields: [
          {
            path: 'contentType',
            code: 'invalid',
            message: 'Use JPEG, PNG ou WebP',
          },
        ],
      });
    }
    if (contentLength > UPLOAD_MAX_BYTES) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Arquivo muito grande',
        fields: [
          {
            path: 'contentLength',
            code: 'too_large',
            message: `Máximo de ${UPLOAD_MAX_BYTES} bytes`,
          },
        ],
      });
    }

    const bucket = this.env.S3_BUCKET;
    const endpoint = this.env.S3_ENDPOINT;
    const accessKey = this.env.S3_ACCESS_KEY;
    const secretKey = this.env.S3_SECRET_KEY;
    if (!bucket || !endpoint || !accessKey || !secretKey) {
      throw new ServiceUnavailableException({
        code: 'UNAVAILABLE',
        message: 'Upload indisponível',
      });
    }

    const key = buildScopedUploadKey(scope, contentType);
    // Presigned PUT (R2 does not implement presigned POST). Content-Type and
    // Content-Length are signed, so the storage rejects a different type or a body
    // whose size differs from the declared (already ≤ UPLOAD_MAX_BYTES) length.
    const uploadUrl = await getSignedUrl(
      this.getClient(),
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
        ContentLength: contentLength,
      }),
      {
        expiresIn: UPLOAD_EXPIRES_SECONDS,
        signableHeaders: new Set(['content-type', 'content-length']),
      },
    );

    return {
      method: 'PUT' as const,
      uploadUrl,
      /** Headers the client must send with the PUT (Content-Length is set by the browser). */
      headers: { 'Content-Type': contentType },
      publicUrl: buildPublicUrl(this.env, bucket, key),
      key,
      contentType,
      contentLength,
      maxBytes: UPLOAD_MAX_BYTES,
      expiresIn: UPLOAD_EXPIRES_SECONDS,
    };
  }

  private getClient(): S3Client {
    if (this.client) {
      return this.client;
    }
    this.client = new S3Client({
      region: this.env.S3_REGION ?? 'auto',
      endpoint: this.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: this.env.S3_ACCESS_KEY!,
        secretAccessKey: this.env.S3_SECRET_KEY!,
      },
      forcePathStyle: true,
    });
    return this.client;
  }
}

function extFor(contentType: string): string {
  switch (contentType) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    default:
      return '';
  }
}

/**
 * Public URL of an uploaded object. Uses S3_PUBLIC_BASE_URL (R2 public bucket
 * domain / r2.dev, already bound to the bucket → `<base>/<key>`); falls back to the
 * path-style API endpoint (`<endpoint>/<bucket>/<key>`, not publicly readable on R2).
 */
export function buildPublicUrl(
  env: Pick<Env, 'S3_PUBLIC_BASE_URL' | 'S3_ENDPOINT'>,
  bucket: string,
  key: string,
): string {
  const publicBase = env.S3_PUBLIC_BASE_URL?.trim().replace(/\/+$/, '');
  if (publicBase) {
    return `${publicBase}/${key}`;
  }
  return `${(env.S3_ENDPOINT ?? '').replace(/\/$/, '')}/${bucket}/${key}`;
}
