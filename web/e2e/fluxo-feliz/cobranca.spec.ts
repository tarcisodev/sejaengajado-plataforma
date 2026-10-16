import { expect, test } from '@playwright/test';

/**
 * Cobrança Asaas sandbox (dev only — never production).
 */
const enabled =
  process.env['E2E_HAPPY_PATH'] === '1' && process.env['E2E_ASAAS_SANDBOX'] === '1';

test.describe('cobranca.spec (FLUXO-FELIZ M3 sandbox)', () => {
  test.skip(!enabled, 'Set E2E_HAPPY_PATH=1 and E2E_ASAAS_SANDBOX=1 on dev stack');

  test('sale generates charge and webhook marks paid idempotently', async ({ page }) => {
    test.fail(true, 'Wire Asaas sandbox + webhook fixture');
    await page.goto('/revenda/vendas');
    await expect(page.locator('body')).toBeVisible();
  });
});
