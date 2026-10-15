import {
  enterTenant,
  getTenantActor,
  requireTenantResellerId,
  runWithTenant,
  runWithTenantAsync,
} from './tenant.context';
import { TenantScopeMissingError } from './tenant.types';

const actor = {
  userId: 'u1',
  role: 'RESELLER' as const,
  resellerId: 'r1',
};

describe('tenant.context', () => {
  it('runs sync/async with tenant actor', async () => {
    expect(getTenantActor()).toBeUndefined();
    expect(runWithTenant(actor, () => requireTenantResellerId())).toBe('r1');
    await expect(
      runWithTenantAsync(actor, async () => requireTenantResellerId()),
    ).resolves.toBe('r1');
  });

  it('enterTenant binds for subsequent reads', () => {
    runWithTenant(actor, () => {
      enterTenant({ ...actor, userId: 'u2' });
      expect(getTenantActor()?.userId).toBe('u2');
    });
  });

  it('requireTenantResellerId fails closed without scope', () => {
    expect(() => requireTenantResellerId()).toThrow(TenantScopeMissingError);
    expect(() =>
      runWithTenant(
        { userId: 'a', role: 'ADMIN', resellerId: null },
        () => requireTenantResellerId(),
      ),
    ).toThrow(TenantScopeMissingError);
  });
});
