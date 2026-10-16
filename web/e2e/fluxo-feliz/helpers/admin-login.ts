import { expect, type Page } from '@playwright/test';

import { totpCode } from './totp';

const appBase = (process.env['E2E_APP_BASE'] ?? 'http://app.localhost:4200').replace(/\/$/, '');

/**
 * E-mail + senha + MFA TOTP for admin.
 * Env: E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_ADMIN_TOTP_SECRET.
 */
export async function loginAdminWithMfa(page: Page): Promise<void> {
  const email = (process.env['E2E_ADMIN_EMAIL'] ?? '').trim();
  const password = (process.env['E2E_ADMIN_PASSWORD'] ?? '').trim();
  if (!email || !password) {
    throw new Error('Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD for admin e2e');
  }
  let totpSecret = (process.env['E2E_ADMIN_TOTP_SECRET'] ?? '').trim();

  await page.context().clearCookies();
  await page.goto(`${appBase}/entrar`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
  });
  await page.goto(`${appBase}/entrar`);
  await page.locator('#email, input[type="email"]').first().fill(email);
  await page.locator('#password, input[type="password"]').first().fill(password);

  const legal = page.locator('[data-legal-accept] [role="checkbox"]').first();
  if (await legal.count()) {
    for (let i = 0; i < 5; i++) {
      if ((await legal.getAttribute('aria-checked')) === 'true') {
        break;
      }
      await legal.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(150);
    }
  }

  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await page.waitForURL(/\/(admin|mfa)/, { timeout: 30_000 });

  if (page.url().includes('/mfa')) {
    if (!totpSecret) {
      const secretEl = page.locator('code').first();
      await secretEl.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => undefined);
      if (await secretEl.isVisible()) {
        totpSecret = ((await secretEl.textContent()) || '').replace(/\s+/g, '').trim();
        if (totpSecret) {
          process.env['E2E_ADMIN_TOTP_SECRET'] = totpSecret;
        }
      }
      if (!totpSecret) {
        throw new Error('MFA já enrolado sem E2E_ADMIN_TOTP_SECRET');
      }
    }
    const mfaInput = page.locator('#mfa-code');
    await mfaInput.click();
    await mfaInput.fill('');
    await mfaInput.pressSequentially(totpCode(totpSecret), { delay: 20 });
    await page.getByRole('button', { name: /Confirmar/i }).click();
    await page.waitForURL(/\/admin/, { timeout: 30_000 });
  }

  await expect(page.locator('body')).toContainText(/Sites|Início|Clientes/i);
}
