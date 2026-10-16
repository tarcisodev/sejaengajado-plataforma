import { expect, type Page } from '@playwright/test';

import { fetchLatestInviteLink, fetchLatestOtp } from './mailpit';
import { acceptLegalIfPresent, clearBrowserSession } from './session';

const appBase = (process.env['E2E_APP_BASE'] ?? 'http://app.localhost:4200').replace(/\/$/, '');

/**
 * First login after invite: open GoTrue verify link (Mailpit or UI), then land on role home.
 * Falls back to OTP once the account is confirmed.
 */
export async function loginWithInviteOrOtp(
  page: Page,
  email: string,
  expectPath: RegExp,
  inviteLinkFromUi?: string | null,
): Promise<void> {
  await clearBrowserSession(page);
  const started = Date.now();

  let inviteLink = (inviteLinkFromUi ?? '').trim();
  if (!inviteLink) {
    try {
      inviteLink = await fetchLatestInviteLink(email, started - 30_000);
    } catch {
      inviteLink = '';
    }
  }

  if (inviteLink) {
    await page.goto(inviteLink, { waitUntil: 'domcontentloaded' });
    try {
      await page.waitForURL(expectPath, { timeout: 45_000 });
      return;
    } catch {
      // Token already used / redirect quirk — try OTP on a confirmed user.
    }
  }

  await loginWithOtp(page, email, expectPath, { clearSession: false, sinceMs: started - 5_000 });
}

/**
 * Magic-link OTP via Mailpit (revendedor / cliente já confirmados — sem MFA).
 */
export async function loginWithOtp(
  page: Page,
  email: string,
  expectPath: RegExp,
  opts?: { clearSession?: boolean; sinceMs?: number },
): Promise<void> {
  if (opts?.clearSession !== false) {
    await clearBrowserSession(page);
  }
  const sinceMs = opts?.sinceMs ?? Date.now() - 5_000;
  await page.goto(`${appBase}/entrar`);
  await page.locator('#email, input[type="email"]').first().fill(email.trim());
  await acceptLegalIfPresent(page);

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
  const otp = await fetchLatestOtp(email, sinceMs);
  await codeField.click();
  await codeField.fill('');
  await codeField.pressSequentially(otp, { delay: 20 });
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await page.waitForURL(expectPath, { timeout: 30_000 });
  await expect(page).toHaveURL(expectPath);
}
