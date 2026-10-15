import { Inject, Injectable } from '@nestjs/common';

import { encodeTimeIdCursor, decodeTimeIdCursor, paginate } from '../common/cursor';
import { ADMIN_PRISMA, type AdminPrisma } from '../tenant/prisma.module';

const SECRET_KEYS = new Set([
  'password',
  'token',
  'authorization',
  'cookie',
  'secret',
  'mfa',
  'mfasecret',
  'mfasecretenc',
  'access_token',
  'refresh_token',
  'service_role',
  'apikey',
  'api_key',
]);

export interface AuditRecordInput {
  actorId: string | null;
  role: string;
  action: string;
  entity: string;
  entityId: string;
  diff?: unknown;
  ip?: string | null;
}

@Injectable()
export class AuditService {
  constructor(@Inject(ADMIN_PRISMA) private readonly adminPrisma: AdminPrisma) {}

  async record(input: AuditRecordInput) {
    return this.adminPrisma.auditLog.create({
      data: {
        actorId: input.actorId,
        role: input.role,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        diff: redactSecrets(input.diff ?? {}) as object,
        ip: input.ip ?? null,
      },
    });
  }

  async list(options: { limit?: number; cursor?: string } = {}) {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
    const cursor = options.cursor ? decodeTimeIdCursor(options.cursor) : null;
    const rows = await this.adminPrisma.auditLog.findMany({
      where: cursor
        ? {
            OR: [
              { createdAt: { lt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { lt: cursor.id } },
            ],
          }
        : undefined,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    return paginate(rows, limit, (row) => encodeTimeIdCursor(row.createdAt, row.id));
  }
}

export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactSecrets(item));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEYS.has(key.toLowerCase())) {
      out[key] = '[Redacted]';
      continue;
    }
    out[key] = redactSecrets(nested);
  }
  return out;
}
