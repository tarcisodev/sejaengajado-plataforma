import { expect, test, type Locator, type Page } from '@playwright/test';

import { appBase, loginReseller, resellerCredentials } from './helpers/reseller-login';

/**
 * #45 caminho feliz do vendedor: Novo site → Cliente → Template → Conteúdo
 * (Identidade com logo e capa; Contato com WhatsApp, endereço e horário; Módulos com
 * catálogo de 3 itens e Pix) → Endereço/slug → Prévia → Publicar → biosite público.
 *
 * Requer stack local (docker-compose dev + API + seed + ng serve/SSR) e um revendedor ACTIVE.
 * Env: E2E_HAPPY_PATH=1, E2E_RESELLER_EMAIL, E2E_RESELLER_PASSWORD;
 * opcionais: E2E_APP_BASE (default http://app.localhost:4200),
 * E2E_PUBLIC_BASE (ex.: http://{slug}.localhost:4200; default {E2E_APEX}/?tenant={slug}),
 * E2E_LOGO_URL / E2E_COVER_URL (imagens usadas no lugar do upload; default: asset
 * web/public/samples/forno.svg servido pelo próprio app em {E2E_APP_BASE}).
 */
const enabled = process.env['E2E_HAPPY_PATH'] === '1' && resellerCredentials() !== null;

const apex = (process.env['E2E_APEX'] ?? 'http://127.0.0.1:4200').replace(/\/$/, '');
const publicBaseTemplate = process.env['E2E_PUBLIC_BASE'] ?? `${apex}/?tenant={slug}`;
/** Asset existente em web/public, servido pelo próprio app (sem dependência remota). */
const logoUrl = process.env['E2E_LOGO_URL'] ?? `${appBase}/samples/forno.svg`;
const coverUrl = process.env['E2E_COVER_URL'] ?? `${appBase}/samples/forno.svg?capa=1`;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const products = [
  { nome: 'Pão de queijo', price: '6,50', label: /R\$\s?6,50/ },
  { nome: 'Café coado', price: '5,00', label: /R\$\s?5,00/ },
  { nome: 'Bolo de fubá', price: '12,90', label: /R\$\s?12,90/ },
] as const;

/** Chave Pix aleatória (EVP) fictícia — não é dado pessoal. */
const pixKey = '7f1c2b9e-4d3a-4e8b-9c1d-2a6b5e0f3c47';

async function wizardNext(editor: Locator): Promise<void> {
  await editor.locator('[data-action="wizard-next"]').click();
}

async function openReseller(page: Page, path: string): Promise<void> {
  const nav = page.locator(`a[href="${path}"]`).first();
  if (await nav.count()) {
    await nav.click();
  } else {
    await page.goto(`${appBase}${path}`);
  }
  await expect(page).toHaveURL(new RegExp(escapeRegExp(path)), { timeout: 20_000 });
}

test.describe('novo-site-biosite.spec (#45 wizard + biosite)', () => {
  test.skip(!enabled, 'Set E2E_HAPPY_PATH=1 + E2E_RESELLER_EMAIL + E2E_RESELLER_PASSWORD');

  test('vendedor cria, preenche, publica e o biosite mostra tudo @smoke', async ({
    page,
    context,
  }) => {
    test.setTimeout(240_000);
    const stamp = Date.now().toString(36);
    const businessName = `E2E Café ${stamp}`;
    const slug = `e2e-cafe-${stamp}`.slice(0, 31);

    await loginReseller(page);
    await openReseller(page, '/revenda/sites');

    // 1. Novo site → Cliente (novo negócio)
    await page.locator('[data-open-wizard]').click();
    const wizard = page.locator('[data-site-wizard]');
    await expect(wizard).toContainText('Novo site');
    await wizard.locator('[data-wizard-customer]').selectOption({ index: 0 });
    await wizard.locator('[data-wizard-new-customer-name]').fill(businessName);
    await wizard.locator('[data-wizard-new-customer-whatsapp]').fill('5534999990000');
    await wizard.locator('[data-wizard-cliente-next]').click();

    // 2. Template → cria o rascunho
    await expect(wizard.locator('[data-wizard-template]')).toBeVisible({ timeout: 15_000 });
    await wizard.locator('[data-wizard-template]').selectOption({ index: 0 });
    await wizard.locator('[data-wizard-template-next]').click();
    await expect(wizard.locator('[data-wizard-draft]')).toBeVisible({ timeout: 20_000 });

    // 3. Conteúdo — Identidade (logo e capa por URL)
    const editor = wizard.locator('[data-wizard-content] [data-site-editor]');
    await expect(editor).toBeVisible();
    await editor.locator('[data-field="businessName"]').fill(businessName);
    await editor.locator('[data-field="slogan"]').fill('Café fresquinho no centro');
    await editor.locator('[data-field="logoUrl"]').fill(logoUrl);
    await editor.locator('[data-field="logoAlt"]').fill(`Logo do ${businessName}`);
    await editor.locator('[data-field="coverUrl"]').fill(coverUrl);
    await editor.locator('[data-field="coverAlt"]').fill('Balcão com pães e café');
    await wizardNext(editor);

    // Contato — WhatsApp, endereço e horário
    await expect(editor.locator('[data-field="whatsapp"]')).toBeVisible();
    await editor.locator('[data-field="whatsapp"]').fill('34 99999-0000');
    await editor.locator('[data-field="logradouro"]').fill('Rua das Flores, 100');
    await editor.locator('[data-field="bairro"]').fill('Centro');
    await editor.locator('[data-field="addressCidade"]').fill('Uberaba');
    await editor.locator('[data-field="addressUf"]').fill('MG');
    await editor.locator('[data-field="cep"]').fill('38010-000');
    const hoursToggle = editor.locator('[data-toggle-hours]');
    if (!(await hoursToggle.isChecked())) {
      await hoursToggle.check();
    }
    // Seg–Sex 08:00–18:00 preenchidos explicitamente (não depende do default).
    for (const day of ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta']) {
      const open = editor.getByLabel(`${day} aberto`, { exact: true });
      if (!(await open.isChecked())) {
        await open.check();
      }
      await editor.getByLabel(`${day} abre`, { exact: true }).fill('08:00');
      await editor.getByLabel(`${day} fecha`, { exact: true }).fill('18:00');
    }
    const saturday = editor.getByLabel('Sábado aberto', { exact: true });
    if (!(await saturday.isChecked())) {
      await saturday.check();
    }
    await editor.getByLabel('Sábado abre', { exact: true }).fill('08:00');
    await editor.getByLabel('Sábado fecha', { exact: true }).fill('13:00');
    await wizardNext(editor);

    // Módulos — catálogo com 3 itens e Pix
    const catalog = editor.locator('[data-module="catalog"]');
    await expect(catalog).toBeVisible();
    const catalogToggle = catalog.locator('[data-toggle-catalog]');
    if (!(await catalogToggle.isChecked())) {
      await catalogToggle.check();
    }
    while ((await catalog.locator('[data-catalog-item]').count()) < products.length) {
      await catalog.locator('[data-action="add-product"]').click();
    }
    for (const [i, item] of products.entries()) {
      const row = catalog.locator('[data-catalog-item]').nth(i);
      await row.locator('[data-field="productName"]').fill(item.nome);
      await row.locator('[data-field="productPrice"]').fill(item.price);
    }
    const pix = editor.locator('[data-module="pix"]');
    const pixToggle = pix.locator('[data-toggle-pix]');
    if (!(await pixToggle.isChecked())) {
      await pixToggle.check();
    }
    await pix.locator('[data-field="pixKey"]').fill(pixKey);
    await pix.locator('[data-field="pixName"]').fill(businessName);
    await wizardNext(editor);

    // 4. Endereço (slug) com checagem ao vivo
    const slugInput = wizard.locator('[data-wizard-slug]');
    await expect(slugInput).toBeVisible({ timeout: 20_000 });
    await slugInput.fill(slug);
    await slugInput.blur();
    await expect(wizard.locator('[data-slug-hint]')).toContainText(/disponível/i, {
      timeout: 15_000,
    });
    await expect(wizard.locator('[data-slug-hint]')).not.toContainText(/indisponível/i);
    await wizard.locator('[data-wizard-create]').click();

    // 5. Prévia ao vivo → Publicar
    const preview = wizard.locator('[data-wizard-live-preview]');
    await expect(preview).toBeVisible({ timeout: 20_000 });
    await expect(preview).toContainText(businessName);
    await expect(preview.locator('[data-catalog-item]')).toHaveCount(products.length);
    await wizard.locator('[data-action="wizard-publish"]').click();
    await page.locator('[data-confirm-verb="Publicar"]').click();
    await expect(page.locator('[data-site-wizard]')).toHaveCount(0, { timeout: 20_000 });

    // Biosite público
    const publicPage = await context.newPage();
    await publicPage.goto(publicBaseTemplate.replace('{slug}', slug));
    const body = publicPage.locator('body');
    await expect(body).toContainText(businessName, { timeout: 30_000 });
    await expect(publicPage.locator('[data-hero-cover] img')).toHaveAttribute(
      'src',
      new RegExp(escapeRegExp(new URL(coverUrl).pathname)),
    );
    await expect(publicPage.locator(`img[src="${logoUrl}"]`).first()).toBeAttached();

    const map = publicPage.locator('[data-block="map"]');
    await expect(map).toContainText('Rua das Flores, 100');
    await expect(map).toContainText('Uberaba');

    const hours = publicPage.locator('[data-block="hours"]');
    await expect(hours).toContainText('Seg a Sex: 08:00–18:00');
    await expect(hours).toContainText('Sáb: 08:00–13:00');

    const items = publicPage.locator('[data-block="catalog"] [data-catalog-item]');
    await expect(items).toHaveCount(products.length);
    for (const item of products) {
      const tile = items.filter({ hasText: item.nome });
      await expect(tile).toHaveCount(1);
      await expect(tile.locator('[data-price]')).toHaveText(item.label);
    }

    await expect(publicPage.locator('[data-block="pix"] [data-pix-key]')).toHaveText(pixKey);
    await expect(publicPage.locator('[data-link="whatsapp"]').first()).toHaveAttribute(
      'href',
      /wa\.me\/(55)?34999990000/,
    );
    await publicPage.close();
  });
});
