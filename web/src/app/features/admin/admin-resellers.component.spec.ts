import { ComponentFixture, TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { API_PORT } from '../../core/api/api-port';
import { MockApiService } from '../../mocks/mock-api.service';
import { AdminResellersComponent } from './admin-resellers.component';

describe('AdminResellersComponent', () => {
  let fixture: ComponentFixture<AdminResellersComponent>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [AdminResellersComponent],
      providers: [MockApiService, { provide: API_PORT, useExisting: MockApiService }],
    });
    fixture = TestBed.createComponent(AdminResellersComponent);
    fixture.componentInstance.today = new Date('2026-10-14T15:00:00.000Z');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('offers migration only to the reseller past the grace period', () => {
    const offers = [...fixture.nativeElement.querySelectorAll('button')].filter((button) =>
      (button as HTMLButtonElement).textContent?.includes('Oferecer migração'),
    );

    expect(offers).toHaveSize(1);
    expect(row('Mídias Uberaba').textContent).toContain('Oferecer migração');
    expect(row('Placas do Triângulo').textContent).not.toContain('Oferecer migração');
  });

  it('keeps an empty block reason from calling the API', async () => {
    const target = row('Vitrine Centro');
    (
      target.querySelector(
        'button[hlmAlertDialogTrigger], button[variant="destructive"]',
      ) as HTMLButtonElement | null
    )?.click();
    fixture.componentInstance.openBlock(
      fixture.componentInstance.rows().find((item) => item.nome === 'Vitrine Centro')!.id,
    );
    fixture.componentInstance.blockReason.set('');
    fixture.componentInstance.confirmBlock();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Motivo obrigatório');
    const resellers = await firstValueFrom(TestBed.inject(MockApiService).listResellers());
    expect(resellers.find((item) => item.nome === 'Vitrine Centro')?.status).toBe('ACTIVE');
  });

  it('blocks with a reason via dialog confirm', async () => {
    const id = fixture.componentInstance.rows().find((item) => item.nome === 'Vitrine Centro')!.id;
    fixture.componentInstance.openBlock(id);
    fixture.componentInstance.blockReason.set('inadimplência');
    fixture.componentInstance.confirmBlock();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const resellers = await firstValueFrom(TestBed.inject(MockApiService).listResellers());
    expect(resellers.find((item) => item.id === id)?.status).toBe('BLOCKED');
  });

  it('creates reseller via API and shows invite link for local email capture (FF1)', async () => {
    const planId = fixture.componentInstance.plans()[0]?.id;
    expect(planId).toBeTruthy();
    fixture.componentInstance.creating.set(true);
    fixture.componentInstance.resellerPlanId.set(planId!);
    fixture.detectChanges();

    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    const nome = form.querySelector('input[name="nome"]') as HTMLInputElement;
    const email = form.querySelector('input[name="email"]') as HTMLInputElement;
    nome.value = 'Revenda FF1';
    email.value = 'ff1-reseller@example.com';
    nome.dispatchEvent(new Event('input'));
    email.dispatchEvent(new Event('input'));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-create-reseller-message]')).toBeTruthy();
    const link = fixture.nativeElement.querySelector('[data-invite-link]') as HTMLElement;
    expect(decodeURIComponent(link?.textContent ?? '')).toContain('ff1-reseller@example.com');
    const resellers = await firstValueFrom(TestBed.inject(MockApiService).listResellers());
    expect(resellers.some((item) => item.nome === 'Revenda FF1')).toBe(true);
  });

  function row(name: string): HTMLTableRowElement {
    const found = [...fixture.nativeElement.querySelectorAll('tbody tr')].find((item) =>
      (item as HTMLElement).textContent?.includes(name),
    ) as HTMLTableRowElement | undefined;
    if (!found) {
      throw new Error(name);
    }
    return found;
  }
});
