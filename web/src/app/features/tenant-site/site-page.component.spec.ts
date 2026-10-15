import { ComponentFixture, TestBed } from '@angular/core/testing';

import { API_PORT } from '../../core/api/api-port';
import { Site, SiteContent } from '../../core/models/domain';
import { MockApiService } from '../../mocks/mock-api.service';
import { createUberabaSeed } from '../../mocks/uberaba-seed';
import { SitePageComponent } from './site-page.component';

describe('SitePageComponent', () => {
  async function render(site: Site): Promise<ComponentFixture<SitePageComponent>> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [SitePageComponent],
      providers: [MockApiService, { provide: API_PORT, useExisting: MockApiService }],
    });
    const fixture = TestBed.createComponent(SitePageComponent);
    fixture.componentInstance.site = site;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  function seedSite(slug: string): Site {
    const site = createUberabaSeed().sites.find((item) => item.slug === slug);
    if (!site) {
      throw new Error(slug);
    }
    return site;
  }

  it('renders the barbershop blocks and hides Pix when it is absent', async () => {
    const fixture = await render(seedSite('barbearia-do-ze'));
    const text = fixture.nativeElement.textContent as string;
    const whatsapp = fixture.nativeElement.querySelector(
      '[data-link="whatsapp"]',
    ) as HTMLAnchorElement;

    expect(text).toContain('Barbearia do Zé');
    expect(text).toContain('Corte');
    expect(text).toContain('R$ 40,00');
    expect(text).toContain('Horários');
    expect(text).toContain('Avaliar no Google');
    expect(text).toContain('feito por');
    expect(fixture.nativeElement.querySelector('[data-block="pix"]')).toBeNull();
    expect(whatsapp.href).toContain('wa.me/5534999990001');
    expect(whatsapp.href).toContain(encodeURIComponent('Olá, quero horário na Barbearia do Zé.'));
    expect(text).not.toMatch(/white label/i);
    expect(text).not.toMatch(/(?<!sub)domínio próprio/);
  });

  it('renders the restaurant prices and the service studio Pix QR', async () => {
    const kitchen = await render(seedSite('pizzaria-forno-da-praca'));
    expect(kitchen.nativeElement.textContent).toContain('R$ 48,00');
    expect(kitchen.nativeElement.querySelector('[data-schema]')?.getAttribute('data-schema')).toBe(
      'Restaurant',
    );
    expect(kitchen.nativeElement.querySelector('.qr')).toBeNull();

    const studio = await render(seedSite('estudio-linha-verde'));
    expect(studio.nativeElement.textContent).toContain('34999990008');
    expect(studio.nativeElement.querySelector('.qr')).not.toBeNull();
    expect(studio.nativeElement.querySelector('[data-block="catalog"]')).toBeNull();
    expect(studio.nativeElement.querySelector('[data-schema]')?.getAttribute('data-schema')).toBe(
      'ProfessionalService',
    );
  });

  it('writes title, canonical, og:image and JSON-LD without a data URI', async () => {
    const fixture = await render(seedSite('barbearia-do-ze'));
    const head = document.head.innerHTML;

    expect(document.title).toBe('Barbearia do Zé | Corte em Uberaba');
    expect(head).toContain('name="description"');
    expect(head).toContain('https://barbearia-do-ze.sejaengajado.com.br/');
    expect(head).toContain('property="og:image"');
    expect(head).toContain('https://sejaengajado.com.br/og.svg');
    expect(head).not.toContain('data:image');

    const script = document.head.querySelector('script[data-site-jsonld]')?.textContent ?? '';
    expect(script).toContain('HairSalon');
    expect(script).toContain('Uberaba-MG');
    fixture.destroy();
  });

  it('omits optional sections on a bare profile', async () => {
    const content: SiteContent = {
      businessName: 'Oficina do Bairro',
      profile: { nome: 'Oficina do Bairro', cidade: 'Uberaba', uf: 'MG' },
      theme: {
        p1: '#1e3a5f',
        p2: '#3d5a4c',
        p3: '#d5e2dc',
        on3: '#102018',
        hi: '#f4f7f6',
        fontHeading: 'Fraunces, serif',
        fontBody: 'Literata, serif',
        fontScale: 1,
        italic: 'normal',
      },
    };
    const site: Site = {
      ...seedSite('oficina-do-bairro'),
      status: 'PUBLISHED',
      content,
    };
    const fixture = await render(site);
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('Oficina do Bairro');
    expect(root.textContent).toContain('Procurando Oficina do Bairro em Uberaba');
    expect(root.querySelector('[data-block="catalog"]')).toBeNull();
    expect(root.querySelector('[data-block="pix"]')).toBeNull();
    expect(root.querySelector('[data-block="promo"]')).toBeNull();
    expect(root.querySelector('[data-link="whatsapp"]')).toBeNull();
  });
});
