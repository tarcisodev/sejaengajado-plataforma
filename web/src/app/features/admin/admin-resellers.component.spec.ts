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
    submit(row('Vitrine Centro'), '');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Motivo obrigatório');
    const resellers = await firstValueFrom(TestBed.inject(MockApiService).listResellers());
    expect(resellers.find((item) => item.nome === 'Vitrine Centro')?.status).toBe('ACTIVE');
  });

  it('suspends the chosen site and leaves it suspended after unblock', async () => {
    const midias = row('Mídias Uberaba');
    submit(midias, 'placa desviada', 'Padaria São Benedito');
    fixture.detectChanges();

    expect(row('Mídias Uberaba').textContent).toContain('BLOCKED');
    let sites = await firstValueFrom(TestBed.inject(MockApiService).listSites());
    expect(sites.find((site) => site.id === 'site_padaria')?.status).toBe('SUSPENDED');

    const unblock = [...row('Mídias Uberaba').querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Desbloquear'),
    ) as HTMLButtonElement;
    unblock.click();
    fixture.detectChanges();

    sites = await firstValueFrom(TestBed.inject(MockApiService).listSites());
    const resellers = await firstValueFrom(TestBed.inject(MockApiService).listResellers());
    expect(resellers.find((item) => item.id === 'res_atrasado')?.status).toBe('ACTIVE');
    expect(sites.find((site) => site.id === 'site_padaria')?.status).toBe('SUSPENDED');
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

  function submit(target: ParentNode, reason: string, siteName?: string): void {
    const input = target.querySelector('input[name="reason"]') as HTMLInputElement;
    input.value = reason;
    if (siteName) {
      const box = [...target.querySelectorAll('input[type="checkbox"]')].find((item) =>
        item.parentElement?.textContent?.includes(siteName),
      ) as HTMLInputElement;
      box.checked = true;
    }
    (target.querySelector('button[type="submit"]') as HTMLButtonElement).click();
  }
});
