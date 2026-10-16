import { expect, test } from '@playwright/test';

/**
 * M0 smoke — read-only, no login.
 * Against production: E2E_BASE_URL=https://sejaengajado.com.br (apex unused; hosts are absolute).
 * Against local: needs showcase seed + web SSR with tenant hosts or ?tenant=.
 */
const prodSmoke = process.env['E2E_PUBLICO_PROD'] === '1';
const apex = (process.env['E2E_APEX'] ?? 'https://sejaengajado.com.br').replace(/\/$/, '');

const demos = [
  { slug: 'demo-forno', name: /Forno/i },
  { slug: 'demo-barbearia', name: /Barbearia|Barba/i },
  { slug: 'demo-estudio', name: /Estúdio|Estudio|Linha/i },
] as const;

test.describe('publico.spec (FLUXO-FELIZ M0)', () => {
  test.skip(!prodSmoke && process.env['E2E_HAPPY_PATH'] !== '1', 'Set E2E_PUBLICO_PROD=1 or E2E_HAPPY_PATH=1');

  for (const demo of demos) {
    test(`${demo.slug} returns 200 with business name`, async ({ request }) => {
      const url = prodSmoke
        ? `https://${demo.slug}.sejaengajado.com.br/`
        : `${apex}/?tenant=${demo.slug}`;
      const res = await request.get(url, { maxRedirects: 0 });
      expect(res.status(), url).toBe(200);
      const body = await res.text();
      expect(body, url).toMatch(demo.name);
      expect(body).not.toMatch(/Negócio não encontrado/i);
      expect(body).not.toMatch(/Não encontramos esse negócio/i);
      expect(body).not.toContain('/api/customer/templates');
      expect(body).not.toContain('/api/admin/templates');
    });
  }

  test('unknown subdomain returns a clean 404', async ({ request }) => {
    const url = prodSmoke
      ? 'https://slug-inexistente-fluxo-feliz.sejaengajado.com.br/'
      : `${apex}/?tenant=slug-inexistente-fluxo-feliz`;
    const res = await request.get(url, { maxRedirects: 0 });
    const body = await res.text();
    // SSR/produção: 404 HTTP. ng serve (CSR): 200 com página de indisponível.
    if (prodSmoke) {
      expect(res.status(), url).toBe(404);
    } else {
      expect([200, 404]).toContain(res.status());
    }
    expect(body).not.toMatch(/404 page not found/i);
    expect(body).toMatch(/não (encontr|está publicado)|Negócio não encontrado/i);
  });

  test('API health ready', async ({ request }) => {
    const healthBase = process.env['E2E_API_BASE'] ?? 'https://app.sejaengajado.com.br';
    const res = await request.get(`${healthBase.replace(/\/$/, '')}/api/health/ready`);
    expect(res.ok()).toBeTruthy();
  });

  test('/entrar is reachable', async ({ page }) => {
    // Chromium resolve *.localhost; o request API do Node no Windows às vezes não.
    const appBase = (process.env['E2E_APP_BASE'] ?? 'https://app.sejaengajado.com.br').replace(
      /\/$/,
      '',
    );
    const res = await page.goto(`${appBase}/entrar`, { waitUntil: 'domcontentloaded' });
    expect(res?.status() ?? 0).toBeGreaterThanOrEqual(200);
    expect(res?.status() ?? 0).toBeLessThan(400);
    await expect(page.locator('body')).toContainText(/Entrar|e-mail|Seja Engajado/i);
  });
});
