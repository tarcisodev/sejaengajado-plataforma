import { expect, test } from '@playwright/test';

import { loginAdminWithMfa } from './helpers/admin-login';

/**
 * Admin MFA → cria site → editor → publica → subdomain → despublica → arquiva.
 * Requires docker-compose dev (auth + Mailpit), ng serve on app host, API + seed.
 *
 * Env: E2E_HAPPY_PATH=1, E2E_ADMIN_EMAIL, E2E_ADMIN_TOTP_SECRET,
 * optional E2E_APP_BASE (default http://app.localhost:4200), E2E_MAILPIT_URL,
 * E2E_PUBLIC_BASE (default http://{slug}.localhost:4200).
 */
const enabled =
  process.env['E2E_HAPPY_PATH'] === '1' && Boolean(process.env['E2E_ADMIN_EMAIL']?.trim());

const appBase = (process.env['E2E_APP_BASE'] ?? 'http://app.localhost:4200').replace(/\/$/, '');
const publicBaseTemplate = process.env['E2E_PUBLIC_BASE'] ?? 'http://{slug}.localhost:4200';

test.describe('admin-site.spec (FLUXO-FELIZ M1)', () => {
  test.skip(!enabled, 'Set E2E_HAPPY_PATH=1 + E2E_ADMIN_EMAIL + E2E_ADMIN_TOTP_SECRET');

  test('admin creates, edits, publishes, unpublishes and archives a site', async ({
    page,
    context,
  }) => {
    test.setTimeout(180_000);
    const stamp = Date.now().toString(36);
    const slug = `e2e-admin-${stamp}`.slice(0, 31);
    const businessName = `E2E Padaria ${stamp}`;

    await loginAdminWithMfa(page);

    const sitesNav = page.locator('a[href="/admin/sites"]').first();
    if (await sitesNav.count()) {
      await sitesNav.click();
    } else {
      await page.goto(`${appBase}/admin/sites`);
    }
    await expect(page).toHaveURL(/\/admin\/sites/, { timeout: 20_000 });
    await page.locator('[data-create-site]').click();
    await page.locator('[data-create-field="businessName"]').fill(businessName);
    await page.locator('[data-create-field="street"]').fill('Rua das Flores, 100');
    await page.locator('[data-create-field="city"]').fill('Uberaba');
    await page.locator('[data-create-field="stateCode"]').fill('MG');
    await page.locator('[data-create-field="slug"]').fill(slug);
    await page.getByRole('button', { name: /Salvar|Criar site/i }).last().click();

    await expect(page.locator('[data-site-editor]')).toBeVisible({ timeout: 20_000 });
    await page.locator('[data-field="businessName"]').fill(businessName);
    await page.locator('[data-field="whatsapp"]').fill('5534999990000');
    await page
      .locator('[data-field="logoUrl"]')
      .fill('https://sejaengajado.com.br/samples/forno.svg');
    await page.locator('[data-action="save"]').click();

    await page.locator('[data-action="publish"]').click();
    await page.locator('[data-confirm-verb="Publicar"]').click();
    await expect(page.locator('[data-site-editor]')).toContainText(/PUBLISHED/i, {
      timeout: 15_000,
    });

    // Public check in another tab so the editor session stays put.
    const publicUrl = publicBaseTemplate.replace('{slug}', slug);
    const publicPage = await context.newPage();
    await publicPage.goto(publicUrl);
    await expect(publicPage.locator('body')).toContainText(businessName, { timeout: 20_000 });
    await publicPage.close();

    await page.locator('[data-action="unpublish"]').click();
    await page.locator('[data-confirm-verb="Despublicar"]').click();
    await expect(page.locator('[data-site-editor]')).toContainText(/DRAFT/i, {
      timeout: 15_000,
    });

    const publicAfter = await context.newPage();
    await publicAfter.goto(publicUrl);
    await expect(publicAfter.locator('body')).toContainText(
      /indisponível|não encontr|não corresponde|não está/i,
      { timeout: 20_000 },
    );
    await publicAfter.close();

    await page.locator('[data-action="archive"]').click();
    await page.locator('[data-confirm-verb="Arquivar"]').click();
    await expect(page.locator('[data-site-editor]')).toHaveCount(0, { timeout: 15_000 });
    await expect(page.locator('[data-create-site]')).toBeVisible({ timeout: 15_000 });

    // Bloquear = Suspender (confirm no listado desktop).
    const suspendBtn = page.locator('table [data-suspend-site]').first();
    await expect(suspendBtn).toBeVisible({ timeout: 10_000 });
    await suspendBtn.click();
    await page.locator('[data-confirm-verb="Suspender"]').click();
    await expect(page.locator('table [data-status="SUSPENDED"]').first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
