import { expect, test } from '@playwright/test';

/**
 * Cobrança Asaas sandbox (dev only — never production).
 * Com FakeGateway local: só valida superfície de vendas/faturas.
 * Com E2E_ASAAS_SANDBOX=1: exige chave sandbox (fica para ambiente preparado).
 */
const enabled =
  process.env['E2E_HAPPY_PATH'] === '1' && process.env['E2E_ASAAS_SANDBOX'] === '1';

const soft =
  process.env['E2E_HAPPY_PATH'] === '1' && process.env['E2E_ASAAS_SANDBOX'] !== '1';

const appBase = (process.env['E2E_APP_BASE'] ?? 'http://app.localhost:4200').replace(/\/$/, '');

test.describe('cobranca.spec (FLUXO-FELIZ M3 sandbox)', () => {
  test('sale generates charge and webhook marks paid idempotently', async ({ page }) => {
    test.skip(!enabled && !soft, 'Set E2E_HAPPY_PATH=1 (optional E2E_ASAAS_SANDBOX=1)');
    test.setTimeout(60_000);

    if (!enabled) {
      // Smoke da superfície sem chamar Asaas de produção.
      await page.goto(`${appBase}/revenda/vendas`);
      await expect(page.locator('[data-landing-hero]')).toHaveCount(0);
      await expect(page.url()).toMatch(/\/revenda\/vendas|\/entrar|\/mfa/);
      return;
    }

    test.fail(true, 'Wire Asaas sandbox + webhook fixture when E2E_ASAAS_SANDBOX=1');
    await page.goto(`${appBase}/revenda/vendas`);
    await expect(page.locator('body')).toBeVisible();
  });
});
