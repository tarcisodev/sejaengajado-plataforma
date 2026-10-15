import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
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

  async createPresignedUpload(body: unknown, resellerId: string) {
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

    const key = buildUploadObjectKey(resellerId, contentType);
    const { url, fields } = await createPresignedPost(this.getClient(), {
      Bucket: bucket,
      Key: key,
      Conditions: uploadPostConditions(contentType, UPLOAD_MAX_BYTES),
      Fields: {
        'Content-Type': contentType,
      },
      Expires: UPLOAD_EXPIRES_SECONDS,
    });

    const publicBase = endpoint.replace(/\/$/, '');
    return {
      method: 'POST' as const,
      uploadUrl: url,
      fields,
      publicUrl: `${publicBase}/${bucket}/${key}`,
      key,
      contentType,
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
