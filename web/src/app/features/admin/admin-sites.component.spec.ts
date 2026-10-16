import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        MockApiService,
        { provide: API_PORT, useExisting: MockApiService },
      ],
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
    expect(fixture.nativeElement.querySelector('[data-status="SUSPENDED"]')?.textContent).toContain(
      'Suspenso',
    );

    const button = [...fixture.nativeElement.querySelectorAll('button')].find((item) =>
      (item as HTMLButtonElement).textContent?.includes('Reativar'),
    ) as HTMLButtonElement;
    expect(button.textContent).toContain('Reativar');
    button.click();
    fixture.detectChanges();

    const sites = await firstValueFrom(TestBed.inject(MockApiService).listSites());
    expect(sites.find((site) => site.slug === 'oficina-suspensa')?.status).toBe('PUBLISHED');
  });

  it('renders confirm-action trigger for suspending a published site', () => {
    const site = fixture.componentInstance.rows().find((row) => row.status === 'PUBLISHED');
    expect(site).toBeTruthy();
    fixture.detectChanges();
    const trigger = fixture.nativeElement.querySelector(
      `[data-site-id="${site!.id}"] [data-suspend-site]`,
    );
    expect(trigger).toBeTruthy();
    expect(trigger.getAttribute('aria-label')).toBe('Suspender site');
  });

  it('opens creation on the admin customer and the custom template', () => {
    fixture.componentInstance.openCreate();

    expect(fixture.componentInstance.customerId()).toBe('cust_admin');
    expect(fixture.componentInstance.templateId()).toBe('tpl_personalizado');
  });

  it('opens the shared editor from the list (bug 0.e)', () => {
    const site = fixture.componentInstance.rows().find((row) => row.status === 'DRAFT');
    expect(site).toBeTruthy();
    fixture.componentInstance.openEditor(site!);
    fixture.detectChanges();
    expect(fixture.componentInstance.editing()?.id).toBe(site!.id);
    expect(fixture.nativeElement.querySelector('[data-site-editor]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-action="publish"]')).toBeTruthy();
  });

  it('navigates to the editor after creating a site', async () => {
    const api = TestBed.inject(MockApiService);
    fixture.componentInstance.openCreate();
    fixture.componentInstance.businessName.set('Padaria Nova');
    fixture.componentInstance.slug.set('padaria-nova');
    fixture.componentInstance.street.set('Rua A');
    fixture.componentInstance.city.set('Uberaba');
    fixture.componentInstance.stateCode.set('MG');
    const event = { preventDefault: () => undefined } as Event;
    fixture.componentInstance.save(event);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.componentInstance.editing()?.slug).toBe('padaria-nova');
    expect(fixture.nativeElement.querySelector('[data-site-editor]')).toBeTruthy();
    const sites = await firstValueFrom(api.listSites());
    expect(sites.some((row) => row.slug === 'padaria-nova')).toBeTrue();
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
