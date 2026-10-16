import { expect, test } from '@playwright/test';

import { loginAdminWithMfa } from './helpers/admin-login';

/**
 * CRUD admin: superfícies de planos, cupons, placas, revendedores, atacado.
 * Templates: assert no create de site (sem página CRUD dedicada ainda).
 */
const enabled =
  process.env['E2E_HAPPY_PATH'] === '1' &&
  Boolean(process.env['E2E_ADMIN_EMAIL']?.trim()) &&
  Boolean(process.env['E2E_ADMIN_TOTP_SECRET']?.trim());

const appBase = (process.env['E2E_APP_BASE'] ?? 'http://app.localhost:4200').replace(/\/$/, '');

test.describe('crud-admin.spec (FLUXO-FELIZ M3)', () => {
  test.skip(!enabled, 'Set E2E_HAPPY_PATH=1 + admin MFA env');

  test('admin CRUD surfaces for catalog entities', async ({ page }) => {
    test.setTimeout(180_000);
    await loginAdminWithMfa(page);

    const paths = [
      '/admin/planos',
      '/admin/cupons',
      '/admin/placas',
      '/admin/revendedores',
      '/admin/atacado',
      '/admin/sites',
    ] as const;

    for (const path of paths) {
      await page.locator(`a[href="${path}"]`).first().click();
      await expect(page).toHaveURL(new RegExp(path.replace(/\//g, '\\/')), { timeout: 15_000 });
      await expect(page.locator('[data-landing-hero]')).toHaveCount(0);
      await expect(page.locator('#conteudo, main').first()).toBeVisible();
    }

    // Planos: criar um plano de teste.
    await page.locator('a[href="/admin/planos"]').first().click();
    const stamp = Date.now().toString(36);
    const code = `E2E_${stamp}`.slice(0, 16);
    await page.locator('input[name="code"]').fill(code);
    await page.locator('input[name="nome"]').fill(`Plano E2E ${stamp}`);
    await page.locator('input[name="precoCentavos"]').fill('19900');
    await page.getByRole('button', { name: /Salvar/i }).first().click();
    await expect(page.locator('body')).toContainText(code, { timeout: 15_000 });

    // Cupons: superfície de formulário.
    await page.locator('a[href="/admin/cupons"]').first().click();
    await expect(page.getByRole('button', { name: /Salvar cupom|Criar|Novo/i }).first()).toBeVisible({
      timeout: 10_000,
    });

    // Placas: estoque.
    await page.locator('a[href="/admin/placas"]').first().click();
    await expect(page.locator('[data-plaque-stock], [data-plaque-in], table, form').first()).toBeVisible();

    // Templates: select no create de site.
    await page.locator('a[href="/admin/sites"]').first().click();
    await page.locator('[data-create-site]').click();
    await expect(page.locator('body')).toContainText(/Template/i);

    void appBase;
  });
});
