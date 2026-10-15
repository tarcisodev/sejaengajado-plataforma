import { randomUUID } from 'node:crypto';

import type { UserRole } from '../../src/common/roles';
import { getHarnessPostgres } from './postgres';

export interface TestUser {
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
    supabaseId: options.supabaseId ?? randomUUID(),
    role,
    resellerId: options.resellerId,
    email: `${role.toLowerCase()}-${randomUUID().slice(0, 8)}@example.com`,
  };
}

export async function insertProbe(label: string): Promise<{ id: string; label: string }> {
  const { prisma } = getHarnessPostgres();
  return prisma.harnessProbe.create({
    data: { id: randomUUID(), label },
    select: { id: true, label: true },
  });
}
