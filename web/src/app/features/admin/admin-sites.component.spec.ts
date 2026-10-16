import { ComponentFixture, TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';

import { API_PORT } from '../../core/api/api-port';
import { GooglePlacesService } from '../../core/google/google-places.service';
import { MockApiService } from '../../mocks/mock-api.service';
import { AdminSitesComponent } from './admin-sites.component';

describe('AdminSitesComponent', () => {
  let fixture: ComponentFixture<AdminSitesComponent>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [AdminSitesComponent],
      providers: [MockApiService, { provide: API_PORT, useExisting: MockApiService }],
    });
    fixture = TestBed.createComponent(AdminSitesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('filters by status and reactivates a suspended site', async () => {
    fixture.componentInstance.status.set('SUSPENDED');
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Oficina Suspensa');
    expect(text).not.toContain('Barbearia do Zé');

    const button = [...fixture.nativeElement.querySelectorAll('button')].find((item) =>
      (item as HTMLButtonElement).textContent?.includes('Reativar'),
    ) as HTMLButtonElement;
    expect(button.textContent).toContain('Reativar');
    button.click();
    fixture.detectChanges();

    const sites = await firstValueFrom(TestBed.inject(MockApiService).listSites());
    expect(sites.find((site) => site.slug === 'oficina-suspensa')?.status).toBe('PUBLISHED');
  });

  it('opens creation on the admin customer and the custom template', () => {
    fixture.componentInstance.openCreate();

    expect(fixture.componentInstance.customerId()).toBe('cust_admin');
    expect(fixture.componentInstance.templateId()).toBe('tpl_personalizado');
  });

  it('fills the form when Google returns one place', () => {
    const places = fixture.debugElement.injector.get(GooglePlacesService);
    spyOn(places, 'search').and.returnValue(
      of([
        {
          nome: 'Tarciso Dev',
          telefone: '(34) 9999-0000',
          address: {
            logradouro: 'Rua dos Crisântemos, 322',
            cidade: 'Uberaba',
            uf: 'MG',
            cep: '38035-080',
          },
        },
      ]),
    );

    fixture.componentInstance.googleQuery.set('Tarciso Dev');
    fixture.componentInstance.searchGoogle();

    expect(fixture.componentInstance.businessName()).toBe('Tarciso Dev');
    expect(fixture.componentInstance.phone()).toBe('(34) 9999-0000');
    expect(fixture.componentInstance.street()).toBe('Rua dos Crisântemos, 322');
    expect(fixture.componentInstance.city()).toBe('Uberaba');
    expect(fixture.componentInstance.stateCode()).toBe('MG');
    expect(fixture.componentInstance.postalCode()).toBe('38035-080');
    expect(fixture.componentInstance.slug()).toBe('tarciso-dev');
  });
});
