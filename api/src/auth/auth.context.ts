import { AsyncLocalStorage } from 'node:async_hooks';

import type { AuthUser } from './auth-user';

const storage = new AsyncLocalStorage<AuthUser>();

export function enterAuthUser(user: AuthUser): void {
  storage.enterWith(user);
}

export function runWithAuthUser<T>(user: AuthUser, fn: () => T): T {
  return storage.run(user, () => {
    storage.enterWith(user);
    return fn();
  });
}

export function getAuthUser(): AuthUser | undefined {
  return storage.getStore();
}

export function requireAdminPrismaAccess(): AuthUser {
  const user = storage.getStore();
  if (!user || user.role !== 'ADMIN') {
    throw new AdminPrismaForbiddenError();
  }
  return user;
}

export class AdminPrismaForbiddenError extends Error {
  constructor() {
    super('ADMIN_PRISMA só pode ser usado em rotas @Roles(ADMIN)');
    this.name = 'AdminPrismaForbiddenError';
  }
}
