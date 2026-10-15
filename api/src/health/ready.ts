import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';

import { ENV, type Env } from '../config/env';

export interface ReadyProbe {
  check(): Promise<boolean>;
}

export const READY_PROBE = Symbol('READY_PROBE');

export async function checkReady(
  db: { query(sql: string): Promise<unknown> },
  queueReady: boolean,
  storageReady = true,
): Promise<boolean> {
  try {
    await db.query('SELECT 1');
  } catch {
    return false;
  }
  return queueReady && storageReady;
}

@Injectable()
export class PgReadyProbe implements ReadyProbe, OnModuleDestroy {
  private readonly pool: Pool;
  private s3: S3Client | null = null;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.pool = new Pool({
      connectionString: env.DATABASE_URL,
      connectionTimeoutMillis: 1000,
    });
  }

  async check(): Promise<boolean> {
    const client = await this.pool.connect().catch(() => null);
    if (!client) {
      return false;
    }
    try {
      const storageReady = await this.checkR2();
      return await checkReady(client, true, storageReady);
    } finally {
      client.release();
    }
  }

  /** HeadBucket on uploads bucket when S3 is configured; skip outside production. */
  async checkR2(): Promise<boolean> {
    const { S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY, S3_REGION, NODE_ENV } = this.env;
    if (!S3_ENDPOINT || !S3_BUCKET || !S3_ACCESS_KEY || !S3_SECRET_KEY) {
      return NODE_ENV !== 'production';
    }
    try {
      if (!this.s3) {
        this.s3 = new S3Client({
          region: S3_REGION ?? 'auto',
          endpoint: S3_ENDPOINT,
          forcePathStyle: true,
          credentials: {
            accessKeyId: S3_ACCESS_KEY,
            secretAccessKey: S3_SECRET_KEY,
          },
        });
      }
      await this.s3.send(new HeadBucketCommand({ Bucket: S3_BUCKET }));
      return true;
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.s3?.destroy();
    await this.pool.end();
  }
}
