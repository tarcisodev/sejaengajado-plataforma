import { AsyncLocalStorage } from 'node:async_hooks';

import { TenantScopeMissingError, type TenantActor } from './tenant.types';

const storage = new AsyncLocalStorage<TenantActor>();

export function runWithTenant<T>(actor: TenantActor, fn: () => T): T {
  return storage.run(actor, () => {
    storage.enterWith(actor);
    return fn();
  });
}

export async function runWithTenantAsync<T>(
  actor: TenantActor,
  fn: () => Promise<T>,
): Promise<T> {
  return storage.run(actor, () => {
    storage.enterWith(actor);
    return fn();
  });
}

/** Bind actor for the rest of the current async resource (Nest guards). */
export function enterTenant(actor: TenantActor): void {
  storage.enterWith(actor);
}

export function getTenantActor(): TenantActor | undefined {
  return storage.getStore();
}

export function requireTenantResellerId(): string {
  const actor = storage.getStore();
  if (!actor?.resellerId) {
    throw new TenantScopeMissingError();
  }
  return actor.resellerId;
}
