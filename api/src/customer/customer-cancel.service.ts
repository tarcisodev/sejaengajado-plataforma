import {
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
    const cfg = await this.db.platformConfig.findUnique({ where: { id: 'default' } });
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

  async cancel(user: AuthUser, siteId: string) {
    const site = await this.sites.getMine(user, siteId);
    const quote = await this.quote(user, siteId);

    await this.db.subscription.updateMany({
      where: { siteId, status: { in: ['ACTIVE', 'PAST_DUE'] } },
      data: { status: 'CANCELLED' },
    });

    const updated = await this.db.site.update({
      where: { id: site.id },
      data: { status: 'ARCHIVED', editable: false },
    });
    this.byHostCache.invalidateSlug(updated.slug);

    await this.db.lifecycleEvent.create({
      data: {
        siteId: site.id,
        resellerId: site.resellerId,
        fromStatus: site.status,
        toStatus: 'ARCHIVED',
        reason: 'customer.cancel',
        penaltyCents: quote.multaCentavos > 0 ? quote.multaCentavos : null,
      },
    });

    let orderId = `penalty:${site.id}`;
    if (quote.multaCentavos > 0) {
      try {
        const charged = await this.billing.chargeCancellationPenalty(site.id);
        if (charged.gatewayPaymentId) {
          orderId = charged.gatewayPaymentId;
        }
      } catch {
        // Site de revenda: multa só no lifecycle (gateway plataforma exige isPlatform).
      }
    }

    const sub = await this.db.subscription.findFirst({
      where: { siteId: site.id },
      orderBy: { createdAt: 'desc' },
    });

    return {
      id: `cancel_${site.id}`,
      siteId: site.id,
      subscriptionId: sub?.id ?? '',
      plaqueValueCentavos: quote.plaqueValueCentavos,
      plaquePenaltyPct: quote.plaquePenaltyPct,
      diasRestantes: quote.diasRestantes,
      mesesRestantes: quote.mesesRestantes,
      multaCentavos: quote.multaCentavos,
      orderId,
      createdAt: new Date().toISOString(),
    };
  }
}
