import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { API_PORT } from '../../core/api/api-port';
import { AuthService } from '../../core/auth/auth.service';
import { ResellerSitesComponent } from './reseller-sites.component';

describe('ResellerSitesComponent (AW3/FF2)', () => {
  function setup(resellerStatus: string) {
    const checkSlug = jasmine.createSpy('checkResellerSlug').and.callFake((slug: string) =>
      of({
        slug,
        available: slug === 'loja-livre',
        code: slug === 'loja-livre' ? undefined : 'SLUG_TAKEN',
      }),
    );
    const draftSite = {
      id: 'site-new',
      resellerId: 'r1',
      customerId: 'c1',
      slug: 'loja-livre',
      templateId: 't1',
      planId: 'p1',
      status: 'DRAFT',
      editable: true,
      content: {
        businessName: 'Cliente',
        profile: { nome: 'Cliente', cidade: 'Uberaba', uf: 'MG' },
        theme: {
          p1: '#1e3a5f',
          p2: '#3d5a4c',
          p3: '#d5e2dc',
          on3: '#102018',
          hi: '#f4f7f6',
          fontHeading: 'Fraunces, Palatino, serif',
          fontBody: 'Literata, Georgia, serif',
          fontScale: 1,
          italic: 'normal',
        },
        pix: { chave: 'exemplo', nome: 'exemplo' },
      },
      publishedAt: null,
      hostingRenewsAt: null,
      plaqueFidelityEndsAt: null,
      customer: { id: 'c1', name: 'Cliente' },
    };
    const createSite = jasmine.createSpy('createResellerSite').and.returnValue(of(draftSite));
    const publishSite = jasmine
      .createSpy('publishResellerSite')
      .and.returnValue(of({ ...draftSite, status: 'PUBLISHED' }));
    const createCustomer = jasmine.createSpy('createResellerCustomer').and.returnValue(
      of({
        id: 'c-new',
        resellerId: 'r1',
        name: 'Padaria Nova',
        doc: '',
        whatsapp: '5534999990000',
        city: '',
      }),
    );
    const recordPlaque = jasmine.createSpy('recordResellerPlaqueMovement').and.returnValue(
      of({
        id: 'm1',
        resellerId: 'r1',
        type: 'OUT',
        plaqueType: 'QR',
        qty: 1,
        unitCostCents: null,
        siteId: 'site-a',
        reason: 'ASSIGN',
        createdAt: new Date().toISOString(),
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
                    status: 'PUBLISHED',
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
            createResellerCustomer: createCustomer,
            publishResellerSite: publishSite,
            unpublishResellerSite: () => of({}),
            patchResellerSite: () => of({}),
            listTemplates: () => of([]),
            recordResellerPlaqueMovement: recordPlaque,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(ResellerSitesComponent);
    fixture.detectChanges();
    return { fixture, createCustomer, publishSite, recordPlaque };
  }

  it('blocks opening the wizard when reseller is DELINQUENT', async () => {
    const { fixture } = setup('DELINQUENT');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-reseller-locked]')).toBeTruthy();
    expect(
      (fixture.nativeElement.querySelector('[data-open-wizard]') as HTMLButtonElement).disabled,
    ).toBeTrue();
  });

  it('shows slug unavailable for taken or reserved values', async () => {
    const { fixture } = setup('ACTIVE');
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

  it('creates a draft after an available slug and shows live preview (FF2)', async () => {
    const { fixture } = setup('ACTIVE');
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
    expect(fixture.nativeElement.querySelector('[data-wizard-live-preview]')).toBeTruthy();
  });

  it('creates a new customer from the wizard when none is selected (FF2)', async () => {
    const { fixture, createCustomer } = setup('ACTIVE');
    await fixture.whenStable();
    fixture.detectChanges();
    fixture.componentInstance.openWizard();
    fixture.componentInstance.customerId.set('');
    fixture.componentInstance.newCustomerName.set('Padaria Nova');
    fixture.componentInstance.newCustomerWhatsapp.set('5534999990000');
    fixture.componentInstance.nextFromCliente();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(createCustomer).toHaveBeenCalled();
    expect(fixture.componentInstance.customerId()).toBe('c-new');
    expect(fixture.componentInstance.step()).toBe('template');
  });

  it('opens plaque panel with review URL and assigns stock OUT (FF4)', async () => {
    const { fixture, recordPlaque } = setup('ACTIVE');
    await fixture.whenStable();
    fixture.detectChanges();

    const site = fixture.componentInstance.rows()[0];
    fixture.componentInstance.openPlaque(site);
    await fixture.componentInstance.refreshPlaqueQr();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-plaque-panel]')).toBeTruthy();
    expect(
      (fixture.nativeElement.querySelector('[data-plaque-review-url]') as HTMLInputElement).value,
    ).toContain('/api/public/r/loja-a/avaliar');
    expect(fixture.nativeElement.querySelector('[data-plaque-qr] img')).toBeTruthy();

    fixture.componentInstance.assignPlaque();
    await fixture.whenStable();
    expect(recordPlaque).toHaveBeenCalledWith(
      jasmine.objectContaining({ type: 'OUT', reason: 'ASSIGN', siteId: 'site-a' }),
      jasmine.any(String),
    );
  });
});
