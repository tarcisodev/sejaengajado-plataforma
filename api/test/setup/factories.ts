import { randomUUID } from 'node:crypto';

import type { UserRole } from '../../src/common/roles';
import { getHarnessPostgres } from './postgres';

export interface TestUser {
  id: string;
  supabaseId: string;
  role: UserRole;
  resellerId?: string;
  email: string;
}

export function buildUser(
  role: UserRole,
  options: { resellerId?: string; supabaseId?: string } = {},
): TestUser {
  return {
    id: randomUUID(),
    supabaseId: options.supabaseId ?? randomUUID(),
    role,
    resellerId: options.resellerId,
    email: `${role.toLowerCase()}-${randomUUID().slice(0, 8)}@example.com`,
  };
}

export async function insertUser(
  role: UserRole,
  options: { resellerId?: string; supabaseId?: string; email?: string } = {},
): Promise<TestUser> {
  const draft = buildUser(role, options);
  const { adminPrisma } = getHarnessPostgres();
  const created = await adminPrisma.user.create({
    data: {
      id: draft.id,
      supabaseId: draft.supabaseId,
      email: options.email ?? draft.email,
      role,
      resellerId: options.resellerId,
      status: 'ACTIVE',
    },
  });
  return {
    id: created.id,
    supabaseId: created.supabaseId,
    role: created.role,
    resellerId: created.resellerId ?? undefined,
    email: created.email,
  };
}
