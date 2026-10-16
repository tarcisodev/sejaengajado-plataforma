import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { AuthUser } from '../auth/auth-user';
import { DirectBillingService } from '../billing/direct-billing.service';
import {
  monthsRemainingFidelity,
  plaquePenaltyCents,
} from '../jobs/penalty';
import { ByHostCache } from '../public/sites/by-host.cache';
import { PRISMA, type TenantPrisma } from '../tenant/prisma.module';
import { CustomerSitesService } from './customer-sites.service';

export interface PlaquePenaltyQuoteDto {
  plaqueValueCentavos: number;
  plaquePenaltyPct: number;
  diasRestantes: number;
  mesesRestantes: number;
  multaCentavos: number;
}

/** Fixed Idempotency-Key for plaque cancellation penalty (one charge per site). */
export function cancelIdempotencyKey(siteId: string): string {
  return `cancel:${siteId}`;
}

@Injectable()
export class CustomerCancelService {
  constructor(
    private readonly sites: CustomerSitesService,
    @Inject(PRISMA) private readonly db: TenantPrisma,
    private readonly billing: DirectBillingService,
    private readonly byHostCache: ByHostCache,
  ) {}

  async quote(user: AuthUser, siteId: string): Promise<PlaquePenaltyQuoteDto> {
    const site = await this.sites.getMine(user, siteId);
    return this.buildQuote(site);
  }

  async cancel(user: AuthUser, siteId: string) {
    const owned = await this.sites.getMine(user, siteId);
    if (owned.status === 'ARCHIVED') {
      throw new ConflictException({
        code: 'ALREADY_CANCELLED',
        message: 'Site já cancelado',
      });
    }

    const result = await this.db.$transaction(async (tx) => {
      const site = await tx.site.findFirst({
        where: { id: siteId, customerId: owned.customerId },
      });
      if (!site) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Recurso não encontrado' });
      }
      if (site.status === 'ARCHIVED') {
        throw new ConflictException({
          code: 'ALREADY_CANCELLED',
          message: 'Site já cancelado',
        });
      }

      const quote = await this.buildQuote(site, tx);

      await tx.subscription.updateMany({
        where: { siteId, status: { in: ['ACTIVE', 'PAST_DUE'] } },
        data: { status: 'CANCELLED' },
      });

      await tx.site.update({
        where: { id: site.id },
        data: { status: 'ARCHIVED', editable: false },
      });

      await tx.lifecycleEvent.create({
        data: {
          siteId: site.id,
          resellerId: site.resellerId,
          fromStatus: site.status,
          toStatus: 'ARCHIVED',
          reason: 'customer.cancel',
          penaltyCents: quote.multaCentavos > 0 ? quote.multaCentavos : null,
        },
      });

      const sub = await tx.subscription.findFirst({
        where: { siteId: site.id },
        orderBy: { createdAt: 'desc' },
      });

      return {
        id: `cancel_${site.id}`,
        siteId: site.id,
        subscriptionId: sub?.id ?? '',
        slug: site.slug,
        plaqueValueCentavos: quote.plaqueValueCentavos,
        plaquePenaltyPct: quote.plaquePenaltyPct,
        diasRestantes: quote.diasRestantes,
        mesesRestantes: quote.mesesRestantes,
        multaCentavos: quote.multaCentavos,
        orderId: `penalty:${site.id}`,
        createdAt: new Date().toISOString(),
      };
    });

    this.byHostCache.invalidateSlug(result.slug);

    let orderId = result.orderId;
    if (result.multaCentavos > 0) {
      try {
        const charged = await this.billing.chargeCancellationPenalty(siteId, {
          idempotencyKey: cancelIdempotencyKey(siteId),
        });
        if (charged.gatewayPaymentId) {
          orderId = charged.gatewayPaymentId;
        }
      } catch {
        // Revenda: multa só no lifecycle (gateway plataforma exige isPlatform).
      }
    }

    const { slug: _slug, ...dto } = result;
    return { ...dto, orderId };
  }

  private async buildQuote(
    site: { plaqueFidelityEndsAt: Date | null },
    db: Pick<TenantPrisma, 'platformConfig'> = this.db,
  ): Promise<PlaquePenaltyQuoteDto> {
    const cfg = await db.platformConfig.findUnique({ where: { id: 'default' } });
    if (!cfg) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Config ausente' });
    }
    const now = new Date();
    const months = site.plaqueFidelityEndsAt
      ? monthsRemainingFidelity(now, site.plaqueFidelityEndsAt)
      : 0;
    const diasRestantes = site.plaqueFidelityEndsAt
      ? Math.max(
          0,
          Math.ceil((site.plaqueFidelityEndsAt.getTime() - now.getTime()) / 86_400_000),
        )
      : 0;
    const multaCentavos = plaquePenaltyCents(
      cfg.plaqueValueCents,
      months,
      cfg.plaquePenaltyPct,
    );
    return {
      plaqueValueCentavos: cfg.plaqueValueCents,
      plaquePenaltyPct: cfg.plaquePenaltyPct,
      diasRestantes,
      mesesRestantes: months,
      multaCentavos,
    };
  }
}
