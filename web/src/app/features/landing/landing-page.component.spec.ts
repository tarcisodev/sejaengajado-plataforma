import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { API_PORT } from '../../core/api/api-port';
import { MockApiService } from '../../mocks/mock-api.service';
import { LandingPageComponent } from './landing-page.component';
import { LANDING_DESCRIPTION, LANDING_OG_IMAGE, LANDING_TITLE, formatBrl } from './landing-seo';

describe('LandingPageComponent', () => {
  let fixture: ComponentFixture<LandingPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LandingPageComponent],
      providers: [
        provideRouter([]),
        MockApiService,
        { provide: API_PORT, useExisting: MockApiService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LandingPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('renders the landing sections and mock prices marked as configurable', () => {
    const text = (fixture.nativeElement.textContent as string).replace(/\u00a0/g, ' ');

    expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain(
      'na porta e na internet',
    );
    expect(fixture.nativeElement.querySelectorAll('#como-funciona li').length).toBe(3);
    expect(fixture.nativeElement.querySelectorAll('[data-landing-demos] .demo-card').length).toBe(
      4,
    );
    expect(text).toContain('demo-forno.sejaengajado.com.br');
    expect(text).toContain('demo-barbearia.sejaengajado.com.br');
    expect(text).toContain('demo-clinica.sejaengajado.com.br');
    expect(text).toContain('demo-estudio.sejaengajado.com.br');
    expect(text).toContain('A placa que conta a visita');
    expect(text).toContain('configuráveis no painel');
    expect(text).toContain(formatBrl(34_700).replace(/\u00a0/g, ' '));
    expect(text).toContain(formatBrl(5_990).replace(/\u00a0/g, ' '));
    expect(text).toContain(formatBrl(12_900).replace(/\u00a0/g, ' '));
    expect(text).toContain('12 meses');
    expect(text).toContain('Primeiro ano de hospedagem incluso');
    expect(text.toLowerCase()).not.toContain('white label');
    expect(text.toLowerCase()).not.toMatch(/(?<!sub)domínio próprio/);
  });

  it('links legal documents in the footer', () => {
    const hrefs = [...fixture.nativeElement.querySelectorAll('footer .legal-links a')].map((el) =>
      (el as HTMLAnchorElement).getAttribute('href'),
    );
    expect(hrefs).toEqual(
      jasmine.arrayContaining([
        '/termos',
        '/privacidade',
        '/uso-aceitavel',
        '/cobranca',
        '/contrato-revenda',
      ]),
    );
  });

  it('links the call to action to WhatsApp and publishes SEO tags', () => {
    const link = fixture.nativeElement.querySelector('a.seal-link-large') as HTMLAnchorElement;
    const description = document.head
      .querySelector('meta[name="description"]')
      ?.getAttribute('content');
    const canonical = document.head
      .querySelector('link[data-landing-canonical]')
      ?.getAttribute('href');
    const jsonLd =
      document.head.querySelector('script[type="application/ld+json"]')?.textContent ?? '';

    expect(link.getAttribute('href')).toContain('https://wa.me/5534999990000');
    expect(link.textContent).toContain('WhatsApp');
    expect(document.title).toBe(LANDING_TITLE);
    expect(description).toBe(LANDING_DESCRIPTION);
    expect(canonical).toBe('https://sejaengajado.com.br/');
    expect(document.head.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe(
      LANDING_OG_IMAGE,
    );
    expect(fixture.nativeElement.querySelector('[data-brand-mark]')?.getAttribute('src')).toContain(
      '/brand/logo-lockup',
    );
    expect(jsonLd).toContain('Uberaba');
    expect(fixture.nativeElement.querySelectorAll('#faq details').length).toBe(5);
  });
});
