import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { API_PORT } from '../../core/api/api-port';
import { AuthService } from '../../core/auth/auth.service';
import { ResellerSitesComponent } from './reseller-sites.component';

describe('ResellerSitesComponent (AW3)', () => {
  function setup(resellerStatus: string): ComponentFixture<ResellerSitesComponent> {
    const checkSlug = jasmine.createSpy('checkResellerSlug').and.callFake((slug: string) =>
      of({
        slug,
        available: slug === 'loja-livre',
        code: slug === 'loja-livre' ? undefined : 'SLUG_TAKEN',
      }),
    );
    const createSite = jasmine.createSpy('createResellerSite').and.returnValue(
      of({
        id: 'site-new',
        resellerId: 'r1',
        customerId: 'c1',
        slug: 'loja-livre',
        templateId: 't1',
        planId: 'p1',
        status: 'DRAFT',
        editable: true,
        content: {},
        publishedAt: null,
        hostingRenewsAt: null,
        plaqueFidelityEndsAt: null,
        customer: { id: 'c1', name: 'Cliente' },
      }),
    );

    TestBed.configureTestingModule({
      imports: [ResellerSitesComponent],
      providers: [
        {
          provide: AuthService,
          useValue: {
            me: signal({
              id: 'u1',
              email: 'r@example.com',
              role: 'RESELLER',
              resellerId: 'r1',
              status: 'ACTIVE',
              resellerStatus,
              aal: 'aal2',
            }),
          },
        },
        {
          provide: API_PORT,
          useValue: {
            listResellerSites: () =>
              of({
                items: [
                  {
                    id: 'site-a',
                    resellerId: 'r1',
                    customerId: 'c1',
                    slug: 'loja-a',
                    templateId: 't1',
                    planId: 'p1',
                    status: 'DRAFT',
                    editable: true,
                    content: {},
                    publishedAt: null,
                    hostingRenewsAt: null,
                    plaqueFidelityEndsAt: null,
                    customer: { id: 'c1', name: 'Cliente' },
                  },
                ],
                nextCursor: null,
              }),
            listResellerCustomers: () =>
              of({
                items: [
                  { id: 'c1', resellerId: 'r1', name: 'Cliente', doc: '', whatsapp: '', city: '' },
                ],
                nextCursor: null,
              }),
            listResellerSiteOptions: () =>
              of({
                plans: [
                  { id: 'p1', code: 'PRONTO', name: 'Pronto', type: 'ONE_TIME', priceCents: 1000 },
                ],
                templates: [{ id: 't1', key: 'svc', name: 'Serviços', niche: 'generico' }],
              }),
            checkResellerSlug: checkSlug,
            createResellerSite: createSite,
            publishResellerSite: () => of({}),
            unpublishResellerSite: () => of({}),
            patchResellerSite: () => of({}),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(ResellerSitesComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('blocks opening the wizard when reseller is DELINQUENT', async () => {
    const fixture = setup('DELINQUENT');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-reseller-locked]')).toBeTruthy();
    expect(
      (fixture.nativeElement.querySelector('[data-open-wizard]') as HTMLButtonElement).disabled,
    ).toBeTrue();
  });

  it('shows slug unavailable for taken or reserved values', async () => {
    const fixture = setup('ACTIVE');
    await fixture.whenStable();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-open-wizard]') as HTMLButtonElement).click();
    fixture.detectChanges();
    fixture.componentInstance.nextFromCliente();
    fixture.detectChanges();
    fixture.componentInstance.nextFromTemplate();
    fixture.detectChanges();
    fixture.componentInstance.nextFromConteudo();
    fixture.detectChanges();

    fixture.componentInstance.slug.set('app');
    fixture.componentInstance.checkSlug();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-slug-hint]')?.textContent).toContain(
      'indisponível',
    );
    expect(
      (fixture.nativeElement.querySelector('[data-wizard-create]') as HTMLButtonElement).disabled,
    ).toBeTrue();
  });

  it('creates a draft after an available slug', async () => {
    const fixture = setup('ACTIVE');
    await fixture.whenStable();
    fixture.detectChanges();
    fixture.componentInstance.openWizard();
    fixture.componentInstance.customerId.set('c1');
    fixture.componentInstance.planId.set('p1');
    fixture.componentInstance.templateId.set('t1');
    fixture.componentInstance.step.set('slug');
    fixture.componentInstance.slug.set('loja-livre');
    fixture.componentInstance.checkSlug();
    await fixture.whenStable();
    fixture.detectChanges();
    fixture.componentInstance.createDraft();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.step()).toBe('previa');
    expect(fixture.nativeElement.querySelector('[data-wizard-preview]')).toBeTruthy();
  });
});
