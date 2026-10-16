import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { z } from 'zod';

import type { AuthUser } from '../auth/auth-user';
import { siteContentSchema } from '../reseller/sites/site-content.schema';
import { ByHostCache } from '../public/sites/by-host.cache';
import { PRISMA, type TenantPrisma } from '../tenant/prisma.module';
import { customerSiteNotEditableReason } from './customer-site-edit';

const patchContentSchema = z.object({
  templateId: z.string().uuid().optional(),
  content: z.unknown().optional(),
});

@Injectable()
export class CustomerSitesService {
  constructor(
    @Inject(PRISMA) private readonly db: TenantPrisma,
    private readonly byHostCache: ByHostCache,
  ) {}

  async listMine(user: AuthUser) {
    const customer = await this.resolveCustomer(user);
    if (!customer) {
      return [];
    }
    return this.db.site.findMany({
      where: { customerId: customer.id },
      include: { customer: true, plan: true, template: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Active templates for the appearance editor (same catalog as reseller options). */
  async listTemplates() {
    return this.db.template.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, key: true, name: true, niche: true },
    });
  }

  async getMine(user: AuthUser, siteId: string) {
    const site = await this.requireOwnedSite(user, siteId);
    return site;
  }

  async updateContent(user: AuthUser, siteId: string, body: unknown) {
    const site = await this.requireOwnedSite(user, siteId);
    this.assertEditable(site);

    const parsed = patchContentSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Dados inválidos',
        fields: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          code: issue.code,
          message: issue.message,
        })),
      });
    }

    const data: {
      templateId?: string;
      content?: object;
    } = {};
    if (parsed.data.templateId !== undefined) {
      data.templateId = parsed.data.templateId;
    }
    if (parsed.data.content !== undefined) {
      const content = siteContentSchema.safeParse(parsed.data.content);
      if (!content.success) {
        throw new BadRequestException({
          code: 'VALIDATION_FAILED',
          message: 'Conteúdo inválido',
          fields: content.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            code: issue.code,
            message: issue.message,
          })),
        });
      }
      data.content = content.data;
    }

    const updated = await this.db.site.update({
      where: { id: site.id },
      data,
      include: { customer: true, plan: true, template: true },
    });
    this.byHostCache.invalidateSlug(updated.slug);
    return updated;
  }

  async publish(user: AuthUser, siteId: string) {
    const site = await this.requireOwnedSite(user, siteId);
    this.assertEditable(site);
    siteContentSchema.parse(site.content);

    const updated = await this.db.site.update({
      where: { id: site.id },
      data: {
        status: 'PUBLISHED',
        publishedAt: site.publishedAt ?? new Date(),
      },
      include: { customer: true, plan: true, template: true },
    });
    this.byHostCache.invalidateSlug(updated.slug);
    return updated;
  }

  private assertEditable(site: {
    editable: boolean;
    status: string;
    plan: { type: string };
  }): void {
    const message = customerSiteNotEditableReason(site);
    if (message) {
      throw new ForbiddenException({
        code: 'SITE_NOT_EDITABLE',
        message,
      });
    }
  }

  private async requireOwnedSite(user: AuthUser, siteId: string) {
    const customer = await this.resolveCustomer(user);
    if (!customer) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Recurso não encontrado' });
    }
    const site = await this.db.site.findFirst({
      where: { id: siteId, customerId: customer.id },
      include: { customer: true, plan: true, template: true },
    });
    if (!site) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Recurso não encontrado' });
    }
    return site;
  }

  private async resolveCustomer(user: AuthUser) {
    const byUser = await this.db.customer.findFirst({
      where: { userId: user.id },
    });
    if (byUser) {
      return byUser;
    }
    const email = user.email.trim().toLowerCase();
    if (!email) {
      return null;
    }
    const byEmail = await this.db.customer.findFirst({
      where: { email },
    });
    if (byEmail && !byEmail.userId) {
      return this.db.customer.update({
        where: { id: byEmail.id },
        data: { userId: user.id },
      });
    }
    return byEmail;
  }
}
