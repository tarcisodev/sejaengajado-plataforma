import { expect, type Page } from '@playwright/test';

import { fetchLatestOtp } from './mailpit';
import { totpCode } from './totp';

const appBase = (process.env['E2E_APP_BASE'] ?? 'http://app.localhost:4200').replace(/\/$/, '');

/**
 * OTP (Mailpit) + MFA TOTP for admin.
 * Prefers `E2E_ADMIN_TOTP_SECRET`; if missing and /mfa shows enroll secret, captures it.
 */
export async function loginAdminWithMfa(page: Page): Promise<void> {
  const email = (process.env['E2E_ADMIN_EMAIL'] ?? '').trim();
  if (!email) {
    throw new Error('Set E2E_ADMIN_EMAIL for admin MFA e2e');
  }
  let totpSecret = (process.env['E2E_ADMIN_TOTP_SECRET'] ?? '').trim();

  const started = Date.now();
  await page.goto(`${appBase}/entrar`);
  await page.locator('#email, input[type="email"]').first().fill(email);

  const legal = page
    .locator('[data-legal-accept] button, [data-legal-accept] [role="checkbox"]')
    .first();
  if (await legal.count()) {
    await legal.click();
  }

  await page.getByRole('button', { name: /Receber código/i }).click();
  const codeField = page.locator('#code');
  const alert = page.locator('[hlmAlert], [role="alert"]');
  await Promise.race([
    codeField.waitFor({ state: 'visible', timeout: 20_000 }),
    alert.waitFor({ state: 'visible', timeout: 20_000 }),
  ]).catch(() => undefined);
  if (!(await codeField.isVisible())) {
    const msg = ((await alert.textContent()) || 'OTP não enviado').trim();
    throw new Error(`Login OTP falhou: ${msg}`);
  }

  const otp = await fetchLatestOtp(email, started - 5_000);
  await page.locator('#code').fill(otp);
  await page.getByRole('button', { name: /^Entrar$/i }).click();

  await page.waitForURL(/\/(admin|mfa)/, { timeout: 30_000 });
  if (page.url().includes('/mfa')) {
    if (!totpSecret) {
      const secretEl = page.locator('code').first();
      const challengeOnly = page.getByRole('heading', {
        name: /Verificação em duas etapas/i,
      });
      await Promise.race([
        secretEl.waitFor({ state: 'visible', timeout: 15_000 }),
        challengeOnly.waitFor({ state: 'visible', timeout: 15_000 }),
      ]).catch(() => undefined);
      if (await secretEl.isVisible()) {
        totpSecret = ((await secretEl.textContent()) || '').replace(/\s+/g, '').trim();
        if (totpSecret) {
          process.env['E2E_ADMIN_TOTP_SECRET'] = totpSecret;
        }
      }
      if (!totpSecret) {
        throw new Error(
          'MFA já enrolado sem E2E_ADMIN_TOTP_SECRET (secret em auth.mfa_factors ou reenrole)',
        );
      }
    }
    const mfaInput = page.locator('#mfa-code');
    await mfaInput.click();
    await mfaInput.fill('');
    // Angular binds via (input); fill() alone leaves the signal empty.
    await mfaInput.pressSequentially(totpCode(totpSecret), { delay: 20 });
    await page.getByRole('button', { name: /Confirmar/i }).click();
    await page.waitForURL(/\/admin/, { timeout: 30_000 });
  }

  await expect(page.locator('body')).toContainText(/Sites|Início|Clientes/i);
}
