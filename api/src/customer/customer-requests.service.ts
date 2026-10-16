import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import type { AuthUser } from '../auth/auth-user';
import { AuditService } from '../audit/audit.service';
import { CustomerSitesService } from './customer-sites.service';

const noteSchema = z.object({
  note: z.string().min(1).max(2000).optional(),
});

@Injectable()
export class CustomerRequestsService {
  constructor(
    private readonly sites: CustomerSitesService,
    private readonly audit: AuditService,
  ) {}

  async requestSiteChange(user: AuthUser, siteId: string, body: unknown) {
    const site = await this.sites.getMine(user, siteId);
    const parsed = noteSchema.safeParse(body ?? {});
    const note = parsed.success ? (parsed.data.note ?? '') : '';
    const row = await this.audit.record({
      actorId: user.id,
      role: user.role,
      action: 'customer.request_site_change',
      entity: 'Site',
      entityId: site.id,
      diff: { note, slug: site.slug },
    });
    return {
      actor: user.role.toLowerCase(),
      acao: row.action,
      entidade: `Site:${site.id}`,
      diff: row.diff,
    };
  }

  async requestMonthlyPlan(user: AuthUser, siteId: string) {
    const site = await this.sites.getMine(user, siteId);
    const row = await this.audit.record({
      actorId: user.id,
      role: user.role,
      action: 'customer.request_monthly_plan',
      entity: 'Site',
      entityId: site.id,
      diff: { slug: site.slug, planId: site.planId },
    });
    return {
      actor: user.role.toLowerCase(),
      acao: row.action,
      entidade: `Site:${site.id}`,
      diff: row.diff,
    };
  }
}
