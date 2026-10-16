import { expect, test } from '@playwright/test';

/**
 * Revendedor A não vê/edita recursos de B (UI + API 403/404).
 */
const enabled = process.env['E2E_M2'] === '1';

test.describe('isolamento.spec (FLUXO-FELIZ M2)', () => {
  test.skip(!enabled, 'Set E2E_M2=1 with two reseller seeds');

  test('reseller A cannot access reseller B resources', async ({ page }) => {
    test.fail(true, 'Wire after dual-reseller auth helpers');
    await page.goto('/revenda');
    await expect(page.locator('body')).toBeVisible();
  });
});
