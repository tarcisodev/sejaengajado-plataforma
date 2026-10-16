import { expect, type Page } from '@playwright/test';

const appBase = (process.env['E2E_APP_BASE'] ?? 'http://app.localhost:4200').replace(/\/$/, '');

/** Credenciais do revendedor vindas do ambiente (nunca fixas no repo). */
export function resellerCredentials(): { email: string; password: string } | null {
  const email = (process.env['E2E_RESELLER_EMAIL'] ?? '').trim();
  const password = (process.env['E2E_RESELLER_PASSWORD'] ?? '').trim();
  return email && password ? { email, password } : null;
}

/**
 * Login do revendedor com e-mail + senha (sem MFA obrigatório) até /revenda.
 * Env: E2E_RESELLER_EMAIL, E2E_RESELLER_PASSWORD, opcional E2E_APP_BASE.
 */
export async function loginReseller(page: Page): Promise<void> {
  const creds = resellerCredentials();
  if (!creds) {
    throw new Error('Set E2E_RESELLER_EMAIL and E2E_RESELLER_PASSWORD for reseller e2e');
  }

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
  await page.locator('#email, input[type="email"]').first().fill(creds.email);
  await page.locator('#password, input[type="password"]').first().fill(creds.password);

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
  await page.waitForURL(/\/revenda/, { timeout: 30_000 });
  await expect(page.locator('body')).toContainText(/Sites|Clientes|Início/i);
}

export { appBase };
