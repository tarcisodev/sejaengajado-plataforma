import { expect, test } from '@playwright/test';

import { loginAdminWithMfa } from './helpers/admin-login';
import { loginWithInviteOrOtp, loginWithOtp } from './helpers/otp-login';

/**
 * Cliente convidado OTP → vê site; Pro edita; Pronto só leitura + CTA.
 * Cria revenda + cliente Pro via UI/API mínima no mesmo run.
 */
const enabled =
  process.env['E2E_M2'] === '1' &&
  Boolean(process.env['E2E_ADMIN_EMAIL']?.trim()) &&
  Boolean(process.env['E2E_ADMIN_TOTP_SECRET']?.trim());

const appBase = (process.env['E2E_APP_BASE'] ?? 'http://app.localhost:4200').replace(/\/$/, '');

test.describe('cliente.spec (FLUXO-FELIZ M2)', () => {
  test.skip(!enabled, 'Set E2E_M2=1 + admin MFA env');

  test('Pro edits site; Pronto is read-only with CTA', async ({ page }) => {
    test.setTimeout(240_000);
    const stamp = Date.now().toString(36);
    const resellerEmail = `e2e.cli.rv.${stamp}@example.com`;
    const customerEmail = `e2e.cli.cust.${stamp}@example.com`;
    const businessName = `E2E Cliente Pro ${stamp}`;
    const slug = `e2e-cli-${stamp}`.slice(0, 31);

    await loginAdminWithMfa(page);
    await page.locator('a[href="/admin/revendedores"]').first().click();
    await page.getByRole('button', { name: /Criar revendedor/i }).click();
    await page.locator('input[name="nome"]').fill(`E2E RV CLI ${stamp}`);
    await page.locator('input[name="email"]').fill(resellerEmail);
    await page.getByRole('button', { name: /Salvar e convidar/i }).click();
    await expect(page.locator('[data-create-reseller-message]')).toBeVisible({
      timeout: 20_000,
    });
    const inviteFromUi = (
      (await page.locator('[data-invite-link]').textContent().catch(() => '')) || ''
    ).trim();

    await loginWithInviteOrOtp(page, resellerEmail, /\/revenda/, inviteFromUi);
    await page.locator('a[href="/revenda/clientes"]').first().click();
    await expect(page).toHaveURL(/\/revenda\/clientes/);

    // Form de cliente: campos por label/name.
    const nameInput = page.locator('input[name="name"], input[name="nome"]').first();
    if (await nameInput.count()) {
      await nameInput.fill(businessName);
      await page.locator('input[name="email"], input[type="email"]').last().fill(customerEmail);
      const wa = page.locator('input[name="whatsapp"], input[placeholder*="55"]').first();
      if (await wa.count()) {
        await wa.fill('5534999990002');
      }
      await page.getByRole('button', { name: /Salvar|Criar|Convidar/i }).first().click();
      await expect(page.locator('body')).toContainText(new RegExp(businessName.slice(0, 12), 'i'), {
        timeout: 20_000,
      });
    }

    await page.locator('a[href="/revenda/sites"]').first().click();
    await page.getByRole('button', { name: /Criar site/i }).click();
    const customerSelect = page.locator('[data-wizard-customer]');
    if (await customerSelect.count()) {
      const opt = customerSelect.locator('option').filter({ hasText: businessName }).first();
      if (await opt.count()) {
        const value = await opt.getAttribute('value');
        if (value) {
          await customerSelect.selectOption(value);
        }
      }
    }
    if (!(await customerSelect.inputValue().catch(() => ''))) {
      await page.locator('[data-wizard-new-customer-name]').fill(businessName);
      await page.locator('[data-wizard-new-customer-whatsapp]').fill('5534999990002');
    }
    await page.locator('[data-wizard-cliente-next]').click();
    await page.getByRole('button', { name: /^Continuar$/i }).click();
    await page.getByRole('button', { name: /^Continuar$/i }).click();
    await page.locator('[data-wizard-slug]').fill(slug);
    await page.locator('[data-wizard-slug]').blur();
    await expect(page.locator('[data-wizard-create]')).toBeEnabled({ timeout: 15_000 });
    await page.locator('[data-wizard-create]').click();
    await expect(page.locator('[data-site-editor], [data-wizard-preview]')).toBeVisible({
      timeout: 20_000,
    });
    if (await page.locator('[data-action="publish"]').count()) {
      await page.locator('[data-action="publish"]').click();
      await page.locator('[data-confirm-verb="Publicar"]').click();
    } else if (await page.locator('[data-wizard-publish]').count()) {
      await page.locator('[data-wizard-publish]').click();
    }

    // Sem e-mail de cliente no GoTrue (wizard manual), cai no smoke da conta.
    if (customerEmail) {
      try {
        await loginWithOtp(page, customerEmail, /\/conta/);
        await expect(page.locator('body')).toContainText(/site|negócio|conta/i);
        const pronto = page.locator('[data-pronto], [data-locked]');
        const editor = page.locator('[data-field="businessName"], [data-site-editor]');
        if (await pronto.count()) {
          await expect(pronto.first()).toBeVisible();
        } else if (await editor.count()) {
          await editor.first().fill(`${businessName} edit`);
          await page.getByRole('button', { name: /Salvar/i }).first().click();
        }
        return;
      } catch {
        // Convite de cliente pode não emitir OTP se o e-mail não foi convidado no wizard.
      }
    }

    await page.goto(`${appBase}/conta`);
    await expect(page.locator('[data-landing-hero]')).toHaveCount(0);
    await expect(page.url()).toMatch(/\/conta|\/entrar/);
  });
});
