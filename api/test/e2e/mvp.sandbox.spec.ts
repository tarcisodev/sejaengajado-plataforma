/**
 * MVP sandbox E2E — só roda com ASAAS_SANDBOX=1.
 * FakeGateway no harness; Asaas real opcional via ASAAS_API_KEY_FILE (nunca commitada).
 *
 * Cenários: PIX pago; boleto vencido → DELINQUENT; estorno → REVERSAL.
 */
import request from 'supertest';

import { DirectBillingService } from '../../src/billing/direct-billing.service';
import { ResellerDelinquencyJob } from '../../src/billing/reseller-delinquency.job';
import { ResellerInvoiceJob } from '../../src/billing/reseller-invoice.job';
import { AsaasWebhookService } from '../../src/payments/webhooks/asaas-webhook.service';
import { createTestApp } from '../setup/create-test-app';
import { insertUser } from '../setup/factories';
import { loginAs } from '../setup/login-as';
import { getHarnessPostgres } from '../setup/postgres';
import { truncateAll } from '../setup/truncate';

const enabled = process.env.ASAAS_SANDBOX === '1';

async function processWebhook(
  webhooks: AsaasWebhookService,
  adminPrisma: ReturnType<typeof getHarnessPostgres>['adminPrisma'],
  eventId: string,
  gatewayPaymentId: string,
): Promise<void> {
  const created = await adminPrisma.webhookEvent.create({
    data: {
      gateway: 'asaas',
      eventId,
      status: 'RECEIVED',
      payload: { paymentId: gatewayPaymentId, event: 'PAYMENT_RECEIVED' },
      attempts: 0,
    },
  });
  await webhooks.processEvent(created.id);
}

(enabled ? describe : describe.skip)('mvp sandbox (ASAAS_SANDBOX=1)', () => {
  async function seedWorld() {
    const { adminPrisma } = getHarnessPostgres();
    await truncateAll();

    const resellerPlan = await adminPrisma.resellerPlan.create({
      data: { name: 'Starter', monthlyFeeCents: 4990 },
    });
    const platform = await adminPrisma.reseller.create({
      data: {
        name: 'PLATAFORMA',
        resellerPlanId: resellerPlan.id,
        status: 'ACTIVE',
        isPlatform: true,
      },
    });
    const reseller = await adminPrisma.reseller.create({
      data: {
        name: 'Revenda Uberaba',
        resellerPlanId: resellerPlan.id,
        status: 'ACTIVE',
        isPlatform: false,
      },
    });
    const template = await adminPrisma.template.create({
      data: {
        key: 'salon',
        name: 'Salão',
        niche: 'beauty',
        schemaType: 'HairSalon',
      },
    });
    const planPronto = await adminPrisma.plan.create({
      data: {
        code: 'PRONTO',
        name: 'Pronto',
        type: 'ONE_TIME',
        priceCents: 29700,
      },
    });
    await adminPrisma.product.create({
      data: {
        code: 'SITE_ONE_TIME',
        name: 'Site Pronto',
        baseWholesaleCents: 990,
      },
    });
    await adminPrisma.platformConfig.create({
      data: {
        id: 'default',
        prontoRenewalCents: 19900,
        plaqueValueCents: 12000,
        plaquePenaltyPct: 100,
        resellerGraceDays: 30,
      },
    });
    const customerDirect = await adminPrisma.customer.create({
      data: {
        name: 'Cliente Direto',
        doc: '00000000000',
        whatsapp: '5534999990000',
        city: 'Uberaba',
        resellerId: platform.id,
      },
    });
    const siteDirect = await adminPrisma.site.create({
      data: {
        customerId: customerDirect.id,
        resellerId: platform.id,
        slug: 'checkout-sandbox',
        templateId: template.id,
        planId: planPronto.id,
        status: 'DRAFT',
        editable: true,
      },
    });
    const customerR = await adminPrisma.customer.create({
      data: {
        name: 'Loja',
        doc: '11111111111',
        whatsapp: '5534999990001',
        city: 'Uberaba',
        resellerId: reseller.id,
      },
    });
    await adminPrisma.site.create({
      data: {
        customerId: customerR.id,
        resellerId: reseller.id,
        slug: 'loja-sandbox',
        templateId: template.id,
        planId: planPronto.id,
        status: 'PUBLISHED',
        editable: true,
      },
    });

    const admin = await insertUser('ADMIN');
    const resellerUser = await insertUser('RESELLER', { resellerId: reseller.id });

    return { platform, reseller, siteDirect, planPronto, admin, resellerUser };
  }

  it('PIX pago, boleto vencido → inadimplência, estorno → REVERSAL', async () => {
    const seeded = await seedWorld();
    const { app, gateway } = await createTestApp();
    const { adminPrisma } = getHarnessPostgres();
    const webhooks = app.get(AsaasWebhookService);
    const direct = app.get(DirectBillingService);

    const adminSession = loginAs('ADMIN', {
      supabaseId: seeded.admin.supabaseId,
      aal: 'aal2',
    });
    const resellerSession = loginAs('RESELLER', {
      supabaseId: seeded.resellerUser.supabaseId,
      resellerId: seeded.reseller.id,
    });

    // --- PIX pago ---
    const pix = await direct.chargePronto({
      siteId: seeded.siteDirect.id,
      customerName: 'Cliente',
      customerEmail: 'cliente@example.com',
      method: 'PIX',
    });
    expect(pix.amountCents).toBe(29700);
    expect(pix.pixCopyPaste).toBeTruthy();

    gateway.markPaid(pix.gatewayPaymentId);
    await processWebhook(webhooks, adminPrisma, `evt_pix_${pix.gatewayPaymentId}`, pix.gatewayPaymentId);

    const paid = await adminPrisma.payment.findFirstOrThrow({
      where: { gatewayPaymentId: pix.gatewayPaymentId },
    });
    expect(paid.status).toBe('PAID');

    const statusRes = await request(app.getHttpServer())
      .get(`/api/billing/payments/${pix.gatewayPaymentId}`)
      .set('Authorization', `Bearer ${adminSession.token}`)
      .expect(200);
    expect(statusRes.body.amountCents).toBe(29700);
    expect(statusRes.body.status).toBe('RECEIVED');

    // Duplicate event id → unique constraint path via second insert skipped in accept;
    // processEvent on PROCESSED event is a no-op claim.
    const dup = await adminPrisma.webhookEvent.findFirst({
      where: { eventId: `evt_pix_${pix.gatewayPaymentId}` },
    });
    expect(dup?.status).toBe('PROCESSED');
    await expect(webhooks.processEvent(dup!.id)).resolves.toBe('PROCESSED');

    // --- Fatura boleto + vencida → DELINQUENT ---
    const invoiceJob = app.get(ResellerInvoiceJob);
    const now = new Date('2026-10-05T18:00:00.000Z');
    await invoiceJob.runOnce(now);

    const invoice = await adminPrisma.resellerInvoice.findFirst({
      where: { resellerId: seeded.reseller.id },
    });
    expect(invoice).toBeTruthy();
    expect(invoice!.totalCents).toBeGreaterThan(0);
    expect(invoice!.gatewayPaymentId).toBeTruthy();

    gateway.setPaymentStatus(invoice!.gatewayPaymentId!, 'OVERDUE', invoice!.totalCents);
    await adminPrisma.resellerInvoice.update({
      where: { id: invoice!.id },
      data: {
        dueDate: new Date('2026-09-01T12:00:00.000Z'),
        status: 'OPEN',
      },
    });

    const delinquency = app.get(ResellerDelinquencyJob);
    await delinquency.runOnce(new Date('2026-10-10T12:00:00.000Z'));

    const resellerAfter = await adminPrisma.reseller.findUniqueOrThrow({
      where: { id: seeded.reseller.id },
    });
    expect(resellerAfter.status).toBe('DELINQUENT');

    const invList = await request(app.getHttpServer())
      .get('/api/reseller/invoices')
      .set('Authorization', `Bearer ${resellerSession.token}`)
      .expect(200);
    expect(invList.body[0].totalCents).toBe(invoice!.totalCents);

    // --- Estorno → REVERSAL (ledger OUT already created on PAID webhook) ---
    gateway.setPaymentStatus(pix.gatewayPaymentId, 'REFUNDED', pix.amountCents);
    const refundEvent = await adminPrisma.webhookEvent.create({
      data: {
        gateway: 'asaas',
        eventId: `evt_refund_${pix.gatewayPaymentId}`,
        status: 'RECEIVED',
        payload: { paymentId: pix.gatewayPaymentId, event: 'PAYMENT_REFUNDED' },
        attempts: 0,
      },
    });
    await webhooks.processEvent(refundEvent.id);

    const refunded = await adminPrisma.payment.findUniqueOrThrow({ where: { id: paid.id } });
    expect(refunded.status).toBe('REFUNDED');

    const reversal = await adminPrisma.ledgerEntry.findFirst({
      where: {
        resellerId: seeded.platform.id,
        category: 'REVERSAL',
        refId: paid.id,
      },
    });
    expect(reversal).toBeTruthy();
    expect(reversal!.amountCents).toBe(pix.amountCents);

    await app.close();
  });
});
