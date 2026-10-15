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

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const MAX_BYTES = 5 * 1024 * 1024;
const EXPIRES_IN = 600;

const requestSchema = z.object({
  contentType: z.string().min(1),
  contentLength: z.number().int().positive(),
  filename: z.string().min(1).max(200).optional(),
});

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
    if (!ALLOWED_TYPES.has(contentType)) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Tipo de arquivo não permitido',
        fields: [
          {
            path: 'contentType',
            code: 'invalid',
            message: 'Use JPEG, PNG, WebP ou GIF',
          },
        ],
      });
    }
    if (contentLength > MAX_BYTES) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Arquivo muito grande',
        fields: [
          {
            path: 'contentLength',
            code: 'too_large',
            message: `Máximo de ${MAX_BYTES} bytes`,
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

    const key = `resellers/${resellerId}/${randomUUID()}${extFor(contentType)}`;
    const client = this.getClient();
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
    });
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: EXPIRES_IN });
    const publicBase = endpoint.replace(/\/$/, '');
    return {
      uploadUrl,
      publicUrl: `${publicBase}/${bucket}/${key}`,
      key,
      contentType,
      maxBytes: MAX_BYTES,
      expiresIn: EXPIRES_IN,
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
    case 'image/gif':
      return '.gif';
    default:
      return '';
  }
}
