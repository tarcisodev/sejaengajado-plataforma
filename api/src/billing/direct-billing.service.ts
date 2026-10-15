import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { applyCouponDiscount } from '../admin/coupons/coupon-discount';
import { spLocalDate } from '../common/sao-paulo-time';
import { LedgerService } from '../ledger/ledger.service';
import { plaquePenaltyCents, monthsRemainingFidelity } from '../jobs/penalty';
import {
  PAYMENT_GATEWAY,
  type PaymentGateway,
} from '../payments/domain/payment-gateway.port';
import { SYSTEM_PRISMA, type SystemPrisma } from '../tenant/prisma.module';
import { directChargeIdempotencyKey, invoicePeriodSp } from './invoice-period';

/**
 * Direct customer charges under reseller PLATAFORMA (Pronto / Pro / renewal / penalty).
 * Money only via PaymentGateway + LedgerService; never cross-tenant.
 */
@Injectable()
export class DirectBillingService {
  constructor(
    @Inject(SYSTEM_PRISMA) private readonly db: SystemPrisma,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
    private readonly ledger: LedgerService,
  ) {}

  async chargePronto(input: {
    siteId: string;
    couponCode?: string;
    customerName: string;
    customerEmail: string;
    method?: 'PIX' | 'BOLETO' | 'CARD';
  }) {
    const { site, platform } = await this.requirePlatformSite(input.siteId);
    if (site.plan.type !== 'ONE_TIME' && site.plan.type !== 'ANNUAL_HOSTING') {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Plano não é Pronto',
      });
    }

    let amountCents = site.plan.priceCents;
    if (input.couponCode) {
      amountCents = await this.applyCoupon(amountCents, input.couponCode);
    }

    const customer = await this.gateway.createCustomer({
      name: input.customerName,
      email: input.customerEmail,
      externalReference: site.customerId,
    });

    const idempotencyKey = directChargeIdempotencyKey(
      'pronto',
      site.id,
      invoicePeriodSp(new Date()),
    );

    const charge = await this.gateway.createCharge({
      gatewayCustomerId: customer.gatewayCustomerId,
      amountCents: Math.max(amountCents, 0),
      method: input.method ?? 'PIX',
      dueDate: spLocalDate(new Date()),
      description: `Pronto — ${site.slug}`,
      idempotencyKey,
      externalReference: site.id,
    });

    const finalCents = Math.max(amountCents, 0);
    const order = await this.db.order.create({
      data: {
        resellerId: platform.id,
        planId: site.planId,
        status: 'PENDING',
        amountCents: finalCents,
        payment: {
          create: {
            resellerId: platform.id,
            method: input.method ?? 'PIX',
            status: 'PENDING',
            amountCents: finalCents,
            gatewayPaymentId: charge.gatewayPaymentId,
          },
        },
      },
      include: { payment: true },
    });

    return {
      orderId: order.id,
      paymentId: order.payment!.id,
      gatewayPaymentId: charge.gatewayPaymentId,
      amountCents: finalCents,
      pixCopyPaste: charge.pixCopyPaste,
      invoiceUrl: charge.invoiceUrl,
    };
  }

  async startProSubscription(input: {
    siteId: string;
    customerName: string;
    customerEmail: string;
    couponCode?: string;
  }) {
    const { site, platform } = await this.requirePlatformSite(input.siteId);
    if (site.plan.type !== 'RECURRING') {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Plano não é Engajado Pro',
      });
    }

    let amountCents = site.plan.priceCents;
    if (input.couponCode) {
      amountCents = await this.applyCoupon(amountCents, input.couponCode);
    }

    const customer = await this.gateway.createCustomer({
      name: input.customerName,
      email: input.customerEmail,
      externalReference: site.customerId,
    });

    const idempotencyKey = directChargeIdempotencyKey(
      'pro',
      site.id,
      invoicePeriodSp(new Date()),
    );

    const sub = await this.gateway.createSubscription({
      gatewayCustomerId: customer.gatewayCustomerId,
      amountCents: Math.max(amountCents, 0),
      cycle: 'MONTHLY',
      nextDueDate: spLocalDate(new Date()),
      description: `Pro — ${site.slug}`,
      idempotencyKey,
      billingType: 'BOLETO',
      externalReference: site.id,
    });

    const fidelityEnds = new Date();
    fidelityEnds.setUTCMonth(fidelityEnds.getUTCMonth() + 12);

    await this.db.$transaction(async (tx) => {
      await tx.subscription.create({
        data: {
          resellerId: platform.id,
          siteId: site.id,
          planId: site.planId,
          status: 'ACTIVE',
          currentPeriodEnd: addMonths(new Date(), 1),
        },
      });
      await tx.site.update({
        where: { id: site.id },
        data: {
          plaqueFidelityEndsAt: fidelityEnds,
          editable: true,
        },
      });
    });

    return {
      gatewaySubscriptionId: sub.gatewaySubscriptionId,
      amountCents: Math.max(amountCents, 0),
      plaqueFidelityEndsAt: fidelityEnds.toISOString(),
    };
  }

  async chargeProntoRenewal(siteId: string) {
    const { site, platform } = await this.requirePlatformSite(siteId);
    const cfg = await this.db.platformConfig.findUnique({ where: { id: 'default' } });
    if (!cfg) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Config ausente' });
    }

    const amountCents = cfg.prontoRenewalCents;
    const customer = await this.gateway.createCustomer({
      name: `Site ${site.slug}`,
      email: `site-${site.id}@renewal.local`,
      externalReference: site.id,
    });

    const period = invoicePeriodSp(new Date());
    const idempotencyKey = directChargeIdempotencyKey('renewal', site.id, period);
    const charge = await this.gateway.createCharge({
      gatewayCustomerId: customer.gatewayCustomerId,
      amountCents,
      method: 'PIX',
      dueDate: spLocalDate(new Date()),
      description: `Renovação Pronto — ${site.slug}`,
      idempotencyKey,
      externalReference: `renewal:${site.id}:${period}`,
    });

    await this.db.order.create({
      data: {
        resellerId: platform.id,
        planId: site.planId,
        status: 'PENDING',
        amountCents,
        payment: {
          create: {
            resellerId: platform.id,
            method: 'PIX',
            status: 'PENDING',
            amountCents,
            gatewayPaymentId: charge.gatewayPaymentId,
          },
        },
      },
    });

    return { gatewayPaymentId: charge.gatewayPaymentId, amountCents };
  }

  /**
   * Cancel Pro before 12 months: charge penalty already stored in LifecycleEvent
   * (or compute from config + fidelity end — uses stored penalty when present).
   */
  async chargeCancellationPenalty(siteId: string) {
    const { site, platform } = await this.requirePlatformSite(siteId);
    const cfg = await this.db.platformConfig.findUnique({ where: { id: 'default' } });
    if (!cfg) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Config ausente' });
    }

    const stored = await this.db.lifecycleEvent.findFirst({
      where: {
        siteId,
        penaltyCents: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });

    const months = site.plaqueFidelityEndsAt
      ? monthsRemainingFidelity(new Date(), site.plaqueFidelityEndsAt)
      : 0;
    const amountCents =
      stored?.penaltyCents ??
      plaquePenaltyCents(cfg.plaqueValueCents, months, cfg.plaquePenaltyPct);

    if (amountCents <= 0) {
      return { gatewayPaymentId: null, amountCents: 0, skipped: true };
    }

    const customer = await this.gateway.createCustomer({
      name: `Site ${site.slug}`,
      email: `site-${site.id}@penalty.local`,
      externalReference: site.id,
    });

    const idempotencyKey = directChargeIdempotencyKey(
      'penalty',
      site.id,
      stored?.id ?? 'live',
    );
    const charge = await this.gateway.createCharge({
      gatewayCustomerId: customer.gatewayCustomerId,
      amountCents,
      method: 'BOLETO',
      dueDate: spLocalDate(new Date()),
      description: `Multa fidelidade — ${site.slug}`,
      idempotencyKey,
      externalReference: `penalty:${site.id}`,
    });

    await this.db.order.create({
      data: {
        resellerId: platform.id,
        planId: site.planId,
        status: 'PENDING',
        amountCents,
        payment: {
          create: {
            resellerId: platform.id,
            method: 'BOLETO',
            status: 'PENDING',
            amountCents,
            gatewayPaymentId: charge.gatewayPaymentId,
          },
        },
      },
    });

    // Ledger OUT only after webhook confirms payment (AsaasWebhookService).
    return { gatewayPaymentId: charge.gatewayPaymentId, amountCents, skipped: false };
  }

  private async requirePlatformSite(siteId: string) {
    const platform = await this.db.reseller.findFirst({ where: { isPlatform: true } });
    if (!platform) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Revendedor plataforma não encontrado',
      });
    }
    const site = await this.db.site.findUnique({
      where: { id: siteId },
      include: { plan: true },
    });
    if (!site || site.resellerId !== platform.id) {
      // A↔B: never leak other tenants
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Site não encontrado' });
    }
    return { site, platform };
  }

  private async applyCoupon(amountCents: number, code: string): Promise<number> {
    const coupon = await this.db.coupon.findUnique({ where: { code } });
    if (!coupon) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Cupom inválido',
      });
    }
    const result = applyCouponDiscount({
      amountCents,
      type: coupon.type,
      value: coupon.value,
      active: coupon.active,
      validFrom: coupon.validFrom,
      validTo: coupon.validTo,
      maxUses: coupon.maxUses,
      usedCount: coupon.usedCount,
    });
    if (!result.ok) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Cupom inválido',
      });
    }
    return result.finalCents;
  }
}

function addMonths(at: Date, months: number): Date {
  const d = new Date(at.getTime());
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}
