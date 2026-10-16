import { expect, test } from '@playwright/test';

/**
 * CRUD admin: planos, cupons, templates, produtos, placas, revendedores.
 */
const enabled =
  process.env['E2E_HAPPY_PATH'] === '1' &&
  Boolean(process.env['E2E_ADMIN_EMAIL']?.trim()) &&
  Boolean(process.env['E2E_ADMIN_TOTP_SECRET']?.trim());

test.describe('crud-admin.spec (FLUXO-FELIZ M3)', () => {
  test.skip(!enabled, 'Set E2E_HAPPY_PATH=1 + admin MFA env');

  test('admin CRUD surfaces for catalog entities', async ({ page }) => {
    test.fail(true, 'Wire entity-by-entity after M2 auth helpers');
    await page.goto('/admin/planos');
    await expect(page.locator('body')).toBeVisible();
  });
});
