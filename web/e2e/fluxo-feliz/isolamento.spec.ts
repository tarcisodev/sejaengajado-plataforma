import { expect, test } from '@playwright/test';

import { loginAdminWithMfa } from './helpers/admin-login';
import { loginWithInviteOrOtp } from './helpers/otp-login';

/**
 * Revendedor A não vê recursos de B (UI + API 404).
 */
const enabled =
  process.env['E2E_M2'] === '1' &&
  Boolean(process.env['E2E_ADMIN_EMAIL']?.trim()) &&
  Boolean(process.env['E2E_ADMIN_TOTP_SECRET']?.trim());

const appBase = (process.env['E2E_APP_BASE'] ?? 'http://app.localhost:4200').replace(/\/$/, '');
const apiBase = (process.env['E2E_API_BASE'] ?? 'http://localhost:3000').replace(/\/$/, '');

test.describe('isolamento.spec (FLUXO-FELIZ M2)', () => {
  test.skip(!enabled, 'Set E2E_M2=1 + admin MFA env');

  test('reseller A cannot access reseller B resources', async ({ page, context }) => {
    test.setTimeout(300_000);
    const stamp = Date.now().toString(36);
    const emailA = `e2e.iso.a.${stamp}@example.com`;
    const emailB = `e2e.iso.b.${stamp}@example.com`;
    const nameA = `ISO A ${stamp}`;
    const slugA = `e2e-iso-a-${stamp}`.slice(0, 31);

    async function inviteReseller(email: string, name: string): Promise<string> {
      await page.locator('a[href="/admin/revendedores"]').first().click();
      await expect(page).toHaveURL(/\/admin\/revendedores/);
      await page.getByRole('button', { name: /Criar revendedor/i }).click();
      await page.locator('input[name="nome"]').fill(name);
      await page.locator('input[name="email"]').fill(email);
      await page.getByRole('button', { name: /Salvar e convidar/i }).click();
      await expect(page.locator('[data-create-reseller-message]')).toBeVisible({
        timeout: 20_000,
      });
      const link = (
        (await page.locator('[data-invite-link]').textContent().catch(() => '')) || ''
      ).trim();
      await page.getByRole('button', { name: /Voltar/i }).click().catch(() => undefined);
      return link;
    }

    await loginAdminWithMfa(page);
    const inviteA = await inviteReseller(emailA, nameA);
    const inviteB = await inviteReseller(emailB, `ISO B ${stamp}`);

    // Revenda A cria um site.
    await loginWithInviteOrOtp(page, emailA, /\/revenda/, inviteA);
    await page.locator('a[href="/revenda/sites"]').first().click();
    await page.getByRole('button', { name: /Criar site/i }).click();
    await page.locator('[data-wizard-new-customer-name]').fill(nameA);
    await page.locator('[data-wizard-new-customer-whatsapp]').fill('5534999990010');
    await page.locator('[data-wizard-cliente-next]').click();
    await page.getByRole('button', { name: /^Continuar$/i }).click();
    await page.getByRole('button', { name: /^Continuar$/i }).click();
    await page.locator('[data-wizard-slug]').fill(slugA);
    await page.locator('[data-wizard-slug]').blur();
    await expect(page.locator('[data-wizard-create]')).toBeEnabled({ timeout: 15_000 });
    await page.locator('[data-wizard-create]').click();
    await expect(page.locator('[data-site-editor], [data-wizard-preview]')).toBeVisible({
      timeout: 20_000,
    });

    // Captura id do site via URL ou listagem.
    let siteId = '';
    const urlMatch = page.url().match(/\/sites\/([0-9a-f-]{36})/i);
    if (urlMatch?.[1]) {
      siteId = urlMatch[1];
    }

    // Token de A (localStorage supabase).
    const tokenA = await page.evaluate(() => {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.includes('auth-token')) {
          continue;
        }
        try {
          const raw = localStorage.getItem(key);
          const parsed = JSON.parse(raw ?? '{}') as {
            access_token?: string;
            currentSession?: { access_token?: string };
          };
          return parsed.access_token ?? parsed.currentSession?.access_token ?? '';
        } catch {
          /* ignore */
        }
      }
      return '';
    });

    if (!siteId && tokenA) {
      const listRes = await page.request.get(`${apiBase}/api/reseller/sites?limit=20`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      expect(listRes.ok()).toBeTruthy();
      const body = (await listRes.json()) as { items?: { id: string; slug: string }[] };
      siteId = body.items?.find((s) => s.slug === slugA)?.id ?? body.items?.[0]?.id ?? '';
    }
    expect(siteId).toBeTruthy();

    // Sessão B: UI não lista o site de A; API dá 404.
    const pageB = await context.newPage();
    await loginWithInviteOrOtp(pageB, emailB, /\/revenda/, inviteB);
    await pageB.locator('a[href="/revenda/sites"]').first().click();
    await expect(pageB.locator('body')).not.toContainText(slugA);

    const tokenB = await pageB.evaluate(() => {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.includes('auth-token')) {
          continue;
        }
        try {
          const raw = localStorage.getItem(key);
          const parsed = JSON.parse(raw ?? '{}') as {
            access_token?: string;
            currentSession?: { access_token?: string };
          };
          return parsed.access_token ?? parsed.currentSession?.access_token ?? '';
        } catch {
          /* ignore */
        }
      }
      return '';
    });
    expect(tokenB).toBeTruthy();

    const forbidden = await pageB.request.get(`${apiBase}/api/reseller/sites/${siteId}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    expect([403, 404]).toContain(forbidden.status());
    await pageB.close();

    void appBase;
  });
});
