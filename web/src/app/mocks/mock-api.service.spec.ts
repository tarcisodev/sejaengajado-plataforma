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
});
