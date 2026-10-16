import { expect, test } from '@playwright/test';

import { loginAdminWithMfa } from './helpers/admin-login';
import { loginWithInviteOrOtp } from './helpers/otp-login';

/**
 * Admin convida revendedor → OTP → cria site → publica → (placa se houver estoque).
 * Env: E2E_M2=1 + E2E_ADMIN_EMAIL + E2E_ADMIN_TOTP_SECRET + stack local.
 */
const enabled =
  process.env['E2E_M2'] === '1' &&
  Boolean(process.env['E2E_ADMIN_EMAIL']?.trim()) &&
  Boolean(process.env['E2E_ADMIN_TOTP_SECRET']?.trim());

const appBase = (process.env['E2E_APP_BASE'] ?? 'http://app.localhost:4200').replace(/\/$/, '');
const webBase = (process.env['E2E_WEB_BASE'] ?? 'http://127.0.0.1:4200').replace(/\/$/, '');
const publicBaseTemplate = process.env['E2E_PUBLIC_BASE'] ?? 'http://{slug}.localhost:4200';

test.describe('revenda-site.spec (FLUXO-FELIZ M2)', () => {
  test.skip(!enabled, 'Set E2E_M2=1 + admin MFA env with local stack');

  test('reseller creates, edits, publishes site and assigns plaque', async ({
    page,
    context,
  }) => {
    test.setTimeout(240_000);
    const stamp = Date.now().toString(36);
    const resellerEmail =
      process.env['E2E_RESELLER_EMAIL']?.trim() || `e2e.revenda.${stamp}@example.com`;
    const resellerName = `E2E Revenda ${stamp}`;
    const slug = `e2e-rv-${stamp}`.slice(0, 31);
    const businessName = `E2E Barbearia ${stamp}`;

    await loginAdminWithMfa(page);
    await page.locator('a[href="/admin/revendedores"]').first().click();
    await expect(page).toHaveURL(/\/admin\/revendedores/, { timeout: 15_000 });
    await page.getByRole('button', { name: /Criar revendedor/i }).click();
    await page.locator('input[name="nome"]').fill(resellerName);
    await page.locator('input[name="email"]').fill(resellerEmail);
    await page.getByRole('button', { name: /Salvar e convidar/i }).click();
    await expect(page.locator('[data-create-reseller-message]')).toBeVisible({
      timeout: 20_000,
    });
    const inviteFromUi = (
      (await page.locator('[data-invite-link]').textContent().catch(() => '')) || ''
    ).trim();

    await loginWithInviteOrOtp(page, resellerEmail, /\/revenda/, inviteFromUi);
    await page.locator('a[href="/revenda/sites"]').first().click();
    await expect(page).toHaveURL(/\/revenda\/sites/, { timeout: 15_000 });
    await page.getByRole('button', { name: /Criar site/i }).click();
    await expect(page.locator('[data-site-wizard]')).toBeVisible();

    await page.locator('[data-wizard-new-customer-name]').fill(businessName);
    await page.locator('[data-wizard-new-customer-whatsapp]').fill('5534999990001');
    await page.locator('[data-wizard-cliente-next]').click();
    await page.getByRole('button', { name: /^Continuar$/i }).click(); // template → conteúdo
    await page.locator('[data-wizard-pix]').fill('e2e-exemplo');
    await page.getByRole('button', { name: /^Continuar$/i }).click(); // conteúdo → slug
    await page.locator('[data-wizard-slug]').fill(slug);
    await page.locator('[data-wizard-slug]').blur();
    await expect(page.locator('[data-wizard-create]')).toBeEnabled({ timeout: 15_000 });
    await page.locator('[data-wizard-create]').click();

    await expect(page.locator('[data-site-editor], [data-wizard-preview]')).toBeVisible({
      timeout: 20_000,
    });

    if (await page.locator('[data-site-editor]').count()) {
      await page.locator('[data-field="businessName"]').fill(businessName);
      await page.locator('[data-field="whatsapp"]').fill('5534999990001');
      await page.locator('[data-action="save"]').click();
      await page.locator('[data-action="publish"]').click();
      await page.locator('[data-confirm-verb="Publicar"]').click();
      await expect(page.locator('[data-site-editor]')).toContainText(/PUBLISHED/i, {
        timeout: 15_000,
      });
    } else {
      await page.locator('[data-wizard-publish]').click();
      await expect(page.locator('body')).toContainText(/PUBLISHED|Publicado/i, {
        timeout: 15_000,
      });
    }

    // ng serve: ?tenant= evita hang em *.localhost; host template fica de fallback.
    const publicUrls = [
      `${webBase}/?tenant=${encodeURIComponent(slug)}`,
      publicBaseTemplate.replace('{slug}', slug),
    ];
    const publicPage = await context.newPage();
    let publicOk = false;
    for (const publicUrl of publicUrls) {
      try {
        await publicPage.goto(publicUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 });
        await expect(publicPage.locator('body')).toContainText(businessName, { timeout: 15_000 });
        publicOk = true;
        break;
      } catch {
        /* try next URL */
      }
    }
    await publicPage.close();
    expect(publicOk, `prévia pública de ${slug}`).toBeTruthy();

    // Placa: painel na lista (estoque pode faltar — então só abre o painel).
    if (await page.locator('[data-site-editor]').count()) {
      await page.locator('[data-back-sites]').click();
    }
    await expect(page.getByRole('button', { name: /Criar site/i }).first()).toBeVisible({
      timeout: 15_000,
    });
    const openPlaque = page.locator('[data-open-plaque]').first();
    if (await openPlaque.count()) {
      await openPlaque.click();
      await expect(page.locator('[data-plaque-panel]')).toBeVisible({ timeout: 10_000 });
      const assign = page.locator('[data-plaque-assign]');
      if ((await assign.count()) && (await assign.isEnabled())) {
        await assign.click();
        await expect(page.locator('[data-plaque-qr], [data-plaque-panel]')).toContainText(
          /placa|QR|NFC|vincul/i,
          { timeout: 10_000 },
        );
      }
      await page.getByRole('button', { name: /Fechar/i }).first().click().catch(() => undefined);
    }

    // VENDA: superfície do formulário (sem exigir estoque de produto).
    await page.locator('a[href="/revenda/vendas"]').first().click();
    await expect(page).toHaveURL(/\/revenda\/vendas/);
    await expect(page.locator('[data-sale-form], form, h1, h2').first()).toBeVisible();
  });
});
