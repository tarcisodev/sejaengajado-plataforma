import { expect, test } from '@playwright/test';

/**
 * Admin convida revendedor → OTP → cria cliente/site → editor → publica → placa.
 * Env: E2E_HAPPY_PATH=1 + E2E_ADMIN_* + E2E_RESELLER_EMAIL (Mailpit OTP).
 */
const enabled = process.env['E2E_M2'] === '1';

test.describe('revenda-site.spec (FLUXO-FELIZ M2)', () => {
  test.skip(!enabled, 'Set E2E_M2=1 with local stack');

  test('reseller creates, edits, publishes site and assigns plaque', async ({ page }) => {
    test.fail(true, 'Wire after invite+OTP helper and VENDA flow');
    await page.goto('/revenda/sites');
    await expect(page.locator('body')).toBeVisible();
  });
});
