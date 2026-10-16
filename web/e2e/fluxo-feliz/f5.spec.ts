import { expect, test } from '@playwright/test';

import { loginAdminWithMfa } from './helpers/admin-login';

/**
 * F5 on painel routes must not render the public landing.
 * Admin path uses MFA helpers; revenda/conta soft-check redirect vs landing.
 */
const enabled = process.env['E2E_HAPPY_PATH'] === '1';
const appBase = (process.env['E2E_APP_BASE'] ?? 'http://app.localhost:4200').replace(/\/$/, '');
const adminReady = Boolean(process.env['E2E_ADMIN_EMAIL']?.trim());

test.describe('f5.spec (FLUXO-FELIZ M1)', () => {
  test.skip(!enabled, 'Set E2E_HAPPY_PATH=1 with app host');

  test('F5 on /admin does not show landing hero', async ({ page }) => {
    test.skip(!adminReady, 'Needs E2E_ADMIN_EMAIL + E2E_ADMIN_TOTP_SECRET');
    test.setTimeout(90_000);
    await loginAdminWithMfa(page);
    await page.goto(`${appBase}/admin`);
    // SSR may bounce to /entrar; login resumes session → /admin.
    await expect(page).toHaveURL(/\/admin/, { timeout: 20_000 });
    await page.reload();
    await expect(page).toHaveURL(/\/admin/, { timeout: 20_000 });
    await expect(page.locator('[data-landing-hero]')).toHaveCount(0);
    await expect(page.locator('#conteudo')).toBeVisible();
  });

  for (const path of ['/revenda', '/conta'] as const) {
    test(`F5 on ${path} does not show landing hero`, async ({ page }) => {
      await page.goto(`${appBase}${path}`);
      await page.reload();
      await expect(page.locator('[data-landing-hero]')).toHaveCount(0);
      const url = page.url();
      expect(url).toMatch(new RegExp(`${path}|/entrar|/mfa`));
    });
  }
});
