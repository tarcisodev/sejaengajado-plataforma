import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { API_PORT } from '../../core/api/api-port';
import { AuthService } from '../../core/auth/auth.service';
import type { AuthMe } from '../../core/auth/auth.types';
import { User } from '../../core/models/domain';
import { MockApiService } from '../../mocks/mock-api.service';
import { formatBrl } from '../landing/landing-seo';
import { CUSTOMER_TODAY, CustomerStudioComponent } from './customer-studio.component';

const TODAY = new Date('2026-10-14T15:00:00.000Z');

describe('CustomerStudioComponent', () => {
  let fixture: ComponentFixture<CustomerStudioComponent>;
  const me = signal<AuthMe | null>(null);

  afterEach(() => {
    fixture?.destroy();
  });

  async function render(user: User): Promise<void> {
    me.set({
      id: user.id,
      email: user.email,
      role: 'CUSTOMER',
      resellerId: null,
      status: 'ACTIVE',
      aal: 'aal1',
    });
    TestBed.configureTestingModule({
      imports: [CustomerStudioComponent],
      providers: [
        MockApiService,
        { provide: API_PORT, useExisting: MockApiService },
        { provide: AuthService, useValue: { me } },
        { provide: CUSTOMER_TODAY, useValue: TODAY },
      ],
    });
    fixture = TestBed.createComponent(CustomerStudioComponent);
    fixture.detectChanges();
  }

  it('reflects a name edit in the live preview and blocks an empty publish', async () => {
    await render(customer('user_forno', 'forno@example.com'));
    fixture.componentInstance.rename('Forno da Vila');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain('Forno da Vila');

    fixture.componentInstance.rename(' ');
    fixture.componentInstance.publish();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Informe o nome do negócio.');
    const sites = await firstValueFrom(
      TestBed.inject(MockApiService).listSitesByCustomer('cust_forno'),
    );
    expect(sites[0].content.businessName).toBe('Pizzaria Forno da Praça');
  });

  it('keeps Pronto read-only and warns about the annual renewal', async () => {
    await render(customer('user_ze', 'ze@example.com'));
    const text = fixture.nativeElement.textContent as string;

    expect(fixture.nativeElement.querySelector('[data-locked]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-pronto]')?.textContent).toContain(
      'Plano Pronto: alterações via suporte',
    );
    expect(fixture.nativeElement.querySelector('[data-field="businessName"]')).toBeNull();
    expect(text).toContain('Assinar o plano mensal');
    expect(text).toContain('Pedir alteração');
    expect(fixture.nativeElement.querySelector('[data-renewal]')?.textContent).toContain(
      '10/01/2027',
    );
  });

  it('rejects upload files that are not jpeg/png/webp or exceed 5 MB', async () => {
    await render(customer('user_forno', 'forno@example.com'));
    fixture.componentInstance.step.set(3);
    fixture.componentInstance.addPhoto();
    fixture.detectChanges();

    const gif = new File([new Uint8Array(16)], 'x.gif', { type: 'image/gif' });
    const gifInput = document.createElement('input');
    Object.defineProperty(gifInput, 'files', { value: [gif] });
    fixture.componentInstance.onPhotoSelected(0, { target: gifInput } as unknown as Event);
    fixture.detectChanges();
    expect(fixture.componentInstance.errors()).toContain('Use JPEG, PNG ou WebP.');

    const huge = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'x.jpg', {
      type: 'image/jpeg',
    });
    const hugeInput = document.createElement('input');
    Object.defineProperty(hugeInput, 'files', { value: [huge] });
    fixture.componentInstance.onPhotoSelected(0, { target: hugeInput } as unknown as Event);
    fixture.detectChanges();
    expect(fixture.componentInstance.errors()[0]).toContain('5 MB');
  });

  it('blocks editing when the site is overdue and read-only', async () => {
    await render(customer('user_ana', 'ana@example.com'));
    const option = [...fixture.nativeElement.querySelectorAll('[data-slot=select-item]')].find(
      (item) => (item as HTMLElement).textContent?.includes('Unidades'),
    ) as HTMLElement;
    option.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-pending]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-field="businessName"]')).toBeNull();
  });

  it('uses the shared site-editor with live preview and keeps niche/strip in the draft (#45)', async () => {
    await render(customer('user_forno', 'forno@example.com'));
    expect(
      fixture.nativeElement.querySelector('[data-studio-editor] [data-site-editor]'),
    ).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('[data-studio-editor] [data-editor-live-preview]'),
    ).toBeTruthy();

    fixture.componentInstance.setNiche('barbearia');
    fixture.componentInstance.setStripEnabled(true);
    fixture.componentInstance.setStripMotif('tesoura');
    fixture.detectChanges();

    const draft = fixture.componentInstance.draft();
    expect(draft?.content.theme.niche).toBe('barbearia');
    expect(draft?.content.strip?.motif).toBe('tesoura');
    expect(
      fixture.nativeElement.querySelector(
        '[data-studio-editor] [data-editor-live-preview] [data-animated-strip]',
      ),
    ).toBeTruthy();

    fixture.componentInstance.resetAppearance();
    fixture.detectChanges();
    expect(fixture.componentInstance.draft()?.content.strip?.enabled).toBe(false);
  });

  it('stores the plaque fine and keeps it after the plaque price changes', async () => {
    await render(customer('user_forno', 'forno@example.com'));
    const quote = await firstValueFrom(
      TestBed.inject(MockApiService).quotePlaquePenalty('site_forno', TODAY),
    );
    fixture.componentInstance.step.set(6);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-penalty]')?.textContent?.replace(/\u00a0/g, ' '),
    ).toContain(formatBrl(quote.multaCentavos).replace(/\u00a0/g, ' '));

    const trigger = [...fixture.nativeElement.querySelectorAll('button')].find((item) =>
      (item as HTMLButtonElement).textContent?.includes('Confirmar cancelamento'),
    ) as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    const confirm = [...document.querySelectorAll('[data-slot=alert-dialog-action]')].find((item) =>
      (item as HTMLButtonElement).textContent?.includes('Confirmar cancelamento'),
    ) as HTMLButtonElement;
    confirm.click();
    fixture.detectChanges();
    await firstValueFrom(
      TestBed.inject(MockApiService).updatePlatformConfig({ plaqueValueCentavos: 20_000 }),
    );
    fixture.detectChanges();

    expect(
      fixture.nativeElement
        .querySelector('[data-cancellation]')
        ?.textContent?.replace(/\u00a0/g, ' '),
    ).toContain(formatBrl(quote.multaCentavos).replace(/\u00a0/g, ' '));
  });
});

function customer(id: string, email: string): User {
  return { id, supabaseId: id, email, role: 'CUSTOMER' };
}
