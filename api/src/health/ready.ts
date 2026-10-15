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
): Promise<boolean> {
  try {
    await db.query('SELECT 1');
  } catch {
    return false;
  }
  return queueReady;
}

@Injectable()
export class PgReadyProbe implements ReadyProbe, OnModuleDestroy {
  private readonly pool: Pool;

  constructor(@Inject(ENV) env: Env) {
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
      return await checkReady(client, true);
    } finally {
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
