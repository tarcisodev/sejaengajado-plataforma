import { expect, test } from '@playwright/test';

/**
 * Cliente convidado OTP → vê site; Pro edita; Pronto só leitura + CTA.
 */
const enabled = process.env['E2E_M2'] === '1';

test.describe('cliente.spec (FLUXO-FELIZ M2)', () => {
  test.skip(!enabled, 'Set E2E_M2=1 with customer invite + Mailpit');

  test('Pro edits site; Pronto is read-only with CTA', async ({ page }) => {
    test.fail(true, 'Wire after customer OTP helper');
    await page.goto('/conta');
    await expect(page.locator('body')).toBeVisible();
  });
});
