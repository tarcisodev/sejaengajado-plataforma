import { firstValueFrom } from 'rxjs';

import { MockApiService } from './mock-api.service';
import {
  RESELLER_ATRASADO,
  RESELLER_CENTRO,
  RESELLER_TRIANGULO,
  SITE_FORNO,
  SUB_FORNO,
} from './uberaba-seed';

describe('MockApiService', () => {
  let service: MockApiService;

  beforeEach(() => {
    service = new MockApiService();
  });

  it('seeds Uberaba config for delay bands, renewal and plaque penalty', async () => {
    const config = await firstValueFrom(service.getPlatformConfig());

    expect(config.notifyFromDias).toBe(1);
    expect(config.readOnlyDias).toBe(8);
    expect(config.suspendDias).toBe(16);
    expect(config.archiveDias).toBe(60);
    expect(config.prontoRenewalCentavos).toBe(12_900);
    expect(config.plaqueValueCentavos).toBe(8_000);
    expect(config.plaquePenaltyPct).toBe(100);
    expect(config.resellerGraceDays).toBe(30);
  });

  it('creates a customer and lists it afterwards', async () => {
    const created = await firstValueFrom(
      service.createCustomer({
        nome: 'Padaria Nova',
        doc: '123',
        whatsapp: '34988887777',
        cidade: 'Uberaba',
        resellerId: null,
      }),
    );
    const customers = await firstValueFrom(service.listCustomers());

    expect(created.userId).toBeNull();
    expect(customers.map((customer) => customer.nome)).toContain('Padaria Nova');
  });

  it('creates an active reseller on the chosen plan', async () => {
    const plans = await firstValueFrom(service.listResellerPlans());
    const created = await firstValueFrom(
      service.createReseller({
        nome: 'Placas Novas',
        userId: 'user_novas',
        resellerPlanId: plans[0].id,
      }),
    );
    const resellers = await firstValueFrom(service.listResellers());

    expect(created.status).toBe('ACTIVE');
    expect(created.blockReason).toBeNull();
    expect(resellers.map((reseller) => reseller.nome)).toContain('Placas Novas');
  });

  it('creates a draft site from the typed address', async () => {
    const [customer] = await firstValueFrom(service.listCustomers());
    const [template] = await firstValueFrom(service.listTemplates());
    const [plan] = await firstValueFrom(service.listPlans());
    const created = await firstValueFrom(
      service.createSite({
        customerId: customer.id,
        templateId: template.id,
        planId: plan.id,
        slug: 'padaria-nova',
        businessName: 'Padaria Nova',
        phone: '3433330000',
        address: { logradouro: 'Rua A, 10', cidade: 'Uberaba', uf: 'MG' },
      }),
    );

    expect(created.status).toBe('DRAFT');
    expect(created.content.phone).toBe('3433330000');
    expect(created.content.address?.logradouro).toBe('Rua A, 10');
    await expectAsync(
      firstValueFrom(
        service.createSite({
          customerId: customer.id,
          templateId: template.id,
          planId: plan.id,
          slug: 'padaria-nova',
          businessName: 'Outra',
          phone: '',
          address: { logradouro: 'Rua B', cidade: 'Uberaba', uf: 'MG' },
        }),
      ),
    ).toBeRejectedWithError('slug taken');
  });

  it('includes the annual hosting plan and Uberaba businesses', async () => {
    const plans = await firstValueFrom(service.listPlans());
    const sites = await firstValueFrom(service.listSites());
    const customers = await firstValueFrom(service.listCustomers());

    expect(plans.map((plan) => plan.tipo)).toContain('ANNUAL_HOSTING');
    expect(
      sites.find((item) => item.slug === 'pizzaria-forno-da-praca')?.plaqueFidelityEndsAt,
    ).toBe('2027-06-15');
    expect(customers.every((customer) => customer.cidade === 'Uberaba')).toBeTrue();
  });

  it('stores the penalty on cancellation and ignores a later plaque price change', async () => {
    const today = new Date('2027-05-01T15:00:00.000Z');
    const cancellation = await firstValueFrom(service.cancelSite(SITE_FORNO, today));

    expect(cancellation.subscriptionId).toBe(SUB_FORNO);
    expect(cancellation.mesesRestantes).toBe(2);
    expect(cancellation.multaCentavos).toBe(1333);

    const order = await firstValueFrom(service.getOrder(cancellation.orderId));
    expect(order?.valorLiquido).toBe(1333);

    await firstValueFrom(
      service.updatePlatformConfig({ plaqueValueCentavos: 20_000, plaquePenaltyPct: 50 }),
    );
    const again = await firstValueFrom(
      service.cancelSite(SITE_FORNO, new Date('2027-06-01T15:00:00.000Z')),
    );

    expect(again.multaCentavos).toBe(1333);
    expect(again.plaqueValueCentavos).toBe(8_000);
    expect(again.orderId).toBe(cancellation.orderId);
  });

  it('hides another reseller data when scoped by resellerId', async () => {
    const trianguloSites = await firstValueFrom(service.listSites(RESELLER_TRIANGULO));
    const centroCustomers = await firstValueFrom(service.listCustomers(RESELLER_CENTRO));
    const directPayments = await firstValueFrom(service.listPayments(null));

    expect(trianguloSites.every((site) => site.resellerId === RESELLER_TRIANGULO)).toBeTrue();
    expect(trianguloSites.map((site) => site.slug)).not.toContain('lanchonete-do-mercado');
    expect(centroCustomers.map((customer) => customer.nome)).toEqual(['Lanchonete do Mercado']);
    expect(directPayments.every((payment) => payment.resellerId === null)).toBeTrue();
  });

  it('bills the closing snapshot of published and read-only sites only once', async () => {
    const first = await firstValueFrom(
      service.closeResellerInvoice(RESELLER_TRIANGULO, '2026-10', '2026-10-31'),
    );

    expect(first.activeSiteIds).toEqual(['site_ana', 'site_leitura']);
    expect(first.mensalidadeCentavos).toBe(4_990);
    expect(first.custoPorSiteAtivoCentavos).toBe(990);
    expect(first.totalCentavos).toBe(4_990 + 2 * 990);

    await firstValueFrom(
      service.blockReseller(RESELLER_TRIANGULO, {
        actorId: 'user_admin',
        reason: 'fraude no anúncio',
        siteIds: ['site_ana'],
        blockedAt: '2026-10-31T18:00:00.000Z',
      }),
    );
    const second = await firstValueFrom(
      service.closeResellerInvoice(RESELLER_TRIANGULO, '2026-10', '2026-11-01'),
    );

    expect(second.activeSiteIds).toEqual(['site_ana', 'site_leitura']);
    expect(second.totalCentavos).toBe(first.totalCentavos);
    expect(second.closedAt).toBe('2026-10-31');
  });

  it('blocks only with a reason, suspends the listed sites and stops new sites', async () => {
    expect(() =>
      service.blockReseller(RESELLER_CENTRO, {
        actorId: 'user_admin',
        reason: '   ',
        siteIds: [],
        blockedAt: '2026-10-14T12:00:00.000Z',
      }),
    ).toThrowError('blockReason is required');

    const blocked = await firstValueFrom(
      service.blockReseller(RESELLER_CENTRO, {
        actorId: 'user_admin',
        reason: 'site clonado de marca',
        siteIds: ['site_mercado'],
        blockedAt: '2026-10-14T12:00:00.000Z',
      }),
    );
    const sites = await firstValueFrom(service.listSites(RESELLER_CENTRO));
    const logs = await firstValueFrom(service.listAuditLogs());

    expect(blocked.status).toBe('BLOCKED');
    expect(blocked.blockReason).toBe('site clonado de marca');
    expect(sites.find((site) => site.id === 'site_mercado')?.status).toBe('SUSPENDED');
    expect(await firstValueFrom(service.canCreateSite(RESELLER_CENTRO))).toBeFalse();
    expect(await firstValueFrom(service.canCreateSite(RESELLER_ATRASADO))).toBeFalse();
    expect(logs[0].acao).toBe('reseller.block');
    expect(logs[0].diff['reason']).toBe('site clonado de marca');
  });

  it('unblocks a reseller without republishing the suspended sites', async () => {
    await firstValueFrom(
      service.blockReseller(RESELLER_CENTRO, {
        actorId: 'user_admin',
        reason: 'site clonado de marca',
        siteIds: ['site_mercado'],
        blockedAt: '2026-10-14T12:00:00.000Z',
      }),
    );

    const restored = await firstValueFrom(
      service.unblockReseller(RESELLER_CENTRO, 'user_admin', '2026-10-20T12:00:00.000Z'),
    );
    const sites = await firstValueFrom(service.listSites(RESELLER_CENTRO));

    expect(restored.status).toBe('ACTIVE');
    expect(restored.blockedAt).toBeNull();
    expect(sites.find((site) => site.id === 'site_mercado')?.status).toBe('SUSPENDED');
    expect(await firstValueFrom(service.canCreateSite(RESELLER_CENTRO))).toBeTrue();
  });

  it('offers migration only after the grace period and refuses archived sites', async () => {
    expect(() =>
      service.offerMigration(RESELLER_ATRASADO, 'user_admin', new Date('2026-09-20T15:00:00.000Z')),
    ).toThrowError('migration is not available');

    const log = await firstValueFrom(
      service.offerMigration(RESELLER_ATRASADO, 'user_admin', new Date('2026-10-14T15:00:00.000Z')),
    );
    expect(log.acao).toBe('reseller.offer-migration');
    expect(() => service.setSiteStatus('site_arquivo', 'PUBLISHED')).toThrowError(
      'site cannot change status',
    );
  });

  it('records one notice per entity, kind and São Paulo date', async () => {
    const notice = {
      entityType: 'Site',
      entityId: SITE_FORNO,
      kind: 'overdue-warning',
      localDate: '2026-10-15',
    };

    expect((await firstValueFrom(service.recordNotice(notice))).created).toBeTrue();
    expect((await firstValueFrom(service.recordNotice(notice))).created).toBeFalse();
  });

  it('signs in a customer with the simulated code and refuses a read-only edit', async () => {
    expect(
      (await firstValueFrom(service.requestCustomerOtp('admin@sejaengajado.com.br'))).delivered,
    ).toBeFalse();

    const otp = await firstValueFrom(service.requestCustomerOtp('forno@example.com'));
    expect(otp.previewCode).toBe('482913');
    const user = await firstValueFrom(service.verifyCustomerOtp('forno@example.com', '482913'));
    expect(user.role).toBe('CUSTOMER');
    expect(() => service.verifyCustomerOtp('forno@example.com', '000000')).toThrowError(
      'invalid code',
    );
    expect(() =>
      service.updateSiteContent('site_leitura', { businessName: 'x' } as never, 'tpl_servicos'),
    ).toThrowError('site cannot be edited');
  });
});
