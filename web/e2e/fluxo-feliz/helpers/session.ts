import { expect, type Page } from '@playwright/test';

const appBase = (process.env['E2E_APP_BASE'] ?? 'http://app.localhost:4200').replace(/\/$/, '');

/** Drop auth so the next /entrar is a clean OTP flow (no sticky admin session). */
export async function clearBrowserSession(page: Page): Promise<void> {
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
}

/** Spartan checkbox re-renders while typing e-mail — retry until aria-checked. */
export async function acceptLegalIfPresent(page: Page): Promise<void> {
  const legal = page.locator('[data-legal-accept] [role="checkbox"]').first();
  if (!(await legal.count())) {
    return;
  }
  await expect(legal).toBeVisible({ timeout: 15_000 });
  for (let attempt = 0; attempt < 5; attempt++) {
    if ((await legal.getAttribute('aria-checked')) === 'true') {
      return;
    }
    await legal.click({ timeout: 5_000, force: true }).catch(() => undefined);
    await page.waitForTimeout(150);
  }
  await expect(legal).toHaveAttribute('aria-checked', 'true', { timeout: 5_000 });
}
