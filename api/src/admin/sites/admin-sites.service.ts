import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { z } from 'zod';

import { decodeTimeIdCursor, encodeTimeIdCursor, paginate } from '../../common/cursor';
import { ByHostCache } from '../../public/sites/by-host.cache';
import { siteContentSchema } from '../../reseller/sites/site-content.schema';
import { SitesService, createSiteSchema } from '../../reseller/sites/sites.service';
import { ADMIN_PRISMA, type AdminPrisma } from '../../tenant/prisma.module';
import { runWithTenantAsync } from '../../tenant/tenant.context';

const statusSchema = z.object({
  status: z.enum(['PUBLISHED', 'SUSPENDED', 'DRAFT', 'ARCHIVED']),
});

const patchContentSchema = z.object({
  templateId: z.string().uuid().optional(),
  content: z.unknown().optional(),
});

const siteSelect = {
  id: true,
  slug: true,
  status: true,
  editable: true,
  isDemo: true,
  resellerId: true,
  customerId: true,
  templateId: true,
  planId: true,
  publishedAt: true,
  createdAt: true,
  customer: { select: { id: true, name: true, email: true, city: true } },
  plan: { select: { id: true, code: true, name: true, type: true } },
  template: { select: { id: true, key: true, name: true, niche: true } },
} as const;

@Injectable()
export class AdminSitesService {
  constructor(
    @Inject(ADMIN_PRISMA) private readonly db: AdminPrisma,
    private readonly sites: SitesService,
    private readonly byHostCache: ByHostCache,
  ) {}

  async list(options: { limit?: number; cursor?: string } = {}) {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
    const cursor = options.cursor ? decodeTimeIdCursor(options.cursor) : null;
    const rows = await this.db.site.findMany({
      where: cursor
        ? {
            OR: [
              { createdAt: { lt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { lt: cursor.id } },
            ],
          }
        : undefined,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: { ...siteSelect, content: true },
    });
    return paginate(rows, limit, (row) => encodeTimeIdCursor(row.createdAt, row.id));
  }

  async create(body: unknown) {
    const parsed = createSiteSchema.safeParse(body);
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

    const customer = await this.db.customer.findUnique({
      where: { id: parsed.data.customerId },
      select: { id: true, resellerId: true },
    });
    if (!customer) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Recurso não encontrado' });
    }

    return runWithTenantAsync(
      {
        userId: 'admin',
        role: 'RESELLER',
        resellerId: customer.resellerId,
      },
      () => this.sites.create(customer.resellerId, body),
    );
  }

  async setStatus(id: string, body: unknown) {
    const parsed = statusSchema.safeParse(body);
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
    const existing = await this.db.site.findUnique({
      where: { id },
      select: { id: true, slug: true, publishedAt: true },
    });
    if (!existing) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Recurso não encontrado' });
    }
    const updated = await this.db.site.update({
      where: { id },
      data: {
        status: parsed.data.status,
        publishedAt:
          parsed.data.status === 'PUBLISHED'
            ? (existing.publishedAt ?? new Date())
            : existing.publishedAt,
      },
      select: siteSelect,
    });
    this.byHostCache.invalidateSlug(updated.slug);
    return updated;
  }

  listTemplates() {
    return this.db.template.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, key: true, name: true, niche: true, schemaType: true, active: true },
    });
  }

  async get(id: string) {
    const site = await this.db.site.findUnique({
      where: { id },
      select: { ...siteSelect, content: true },
    });
    if (!site) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Recurso não encontrado' });
    }
    return site;
  }

  async updateContent(id: string, body: unknown) {
    const existing = await this.db.site.findUnique({
      where: { id },
      select: { id: true, slug: true },
    });
    if (!existing) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Recurso não encontrado' });
    }
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
    const data: { templateId?: string; content?: object } = {};
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
            path: ['content', ...issue.path].join('.'),
            code: issue.code,
            message: issue.message,
          })),
        });
      }
      data.content = content.data;
    }
    const updated = await this.db.site.update({
      where: { id },
      data,
      select: { ...siteSelect, content: true },
    });
    this.byHostCache.invalidateSlug(updated.slug);
    return updated;
  }

  async publish(id: string) {
    const site = await this.get(id);
    siteContentSchema.parse(site.content);
    const updated = await this.db.site.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: site.publishedAt ?? new Date(),
      },
      select: { ...siteSelect, content: true },
    });
    this.byHostCache.invalidateSlug(updated.slug);
    return updated;
  }

  async unpublish(id: string) {
    const existing = await this.db.site.findUnique({
      where: { id },
      select: { id: true, slug: true },
    });
    if (!existing) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Recurso não encontrado' });
    }
    const updated = await this.db.site.update({
      where: { id },
      data: { status: 'DRAFT' },
      select: { ...siteSelect, content: true },
    });
    this.byHostCache.invalidateSlug(existing.slug);
    return updated;
  }

  async archive(id: string) {
    return this.setStatus(id, { status: 'ARCHIVED' });
  }
}
