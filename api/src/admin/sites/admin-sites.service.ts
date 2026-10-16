import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { decodeTimeIdCursor, encodeTimeIdCursor, paginate } from '../../common/cursor';
import { ByHostCache } from '../../public/sites/by-host.cache';
import { siteContentSchema } from '../../reseller/sites/site-content.schema';
import {
  assertSlugFormat,
  assertSlugNotBrand,
  normalizeSlug,
  slugReservedError,
  slugTakenError,
} from '../../reseller/sites/slug';
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

/** Admin Advanced: slug, plan, status, customer, reseller owner. */
const patchMetaSchema = z.object({
  slug: z.string().min(3).max(31).optional(),
  planId: z.string().uuid().optional(),
  status: z.enum(['PUBLISHED', 'SUSPENDED', 'DRAFT', 'ARCHIVED', 'READ_ONLY']).optional(),
  customerId: z.string().uuid().optional(),
  resellerId: z.string().uuid().optional(),
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

  async patchMeta(id: string, body: unknown) {
    const existing = await this.db.site.findUnique({
      where: { id },
      select: { id: true, slug: true, publishedAt: true, customerId: true, resellerId: true },
    });
    if (!existing) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Recurso não encontrado' });
    }
    const parsed = patchMetaSchema.safeParse(body);
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

    const data: Prisma.SiteUpdateInput = {};
    let nextCustomerId = existing.customerId;
    let nextResellerId = existing.resellerId;

    if (parsed.data.customerId !== undefined) {
      const customer = await this.db.customer.findUnique({
        where: { id: parsed.data.customerId },
        select: { id: true, resellerId: true },
      });
      if (!customer) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Cliente não encontrado' });
      }
      nextCustomerId = customer.id;
      nextResellerId = customer.resellerId;
      data.customer = { connect: { id: customer.id } };
      data.reseller = { connect: { id: customer.resellerId } };
    }

    if (parsed.data.resellerId !== undefined && parsed.data.customerId === undefined) {
      const reseller = await this.db.reseller.findUnique({
        where: { id: parsed.data.resellerId },
        select: { id: true },
      });
      if (!reseller) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Revendedor não encontrado' });
      }
      nextResellerId = reseller.id;
      data.reseller = { connect: { id: reseller.id } };
    }

    if (parsed.data.planId !== undefined) {
      const plan = await this.db.plan.findUnique({
        where: { id: parsed.data.planId },
        select: { id: true },
      });
      if (!plan) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Plano não encontrado' });
      }
      data.plan = { connect: { id: plan.id } };
    }

    if (parsed.data.slug !== undefined) {
      const slug = normalizeSlug(parsed.data.slug);
      assertSlugFormat(slug);
      assertSlugNotBrand(slug);
      const reserved = await this.db.reservedSlug.findUnique({ where: { slug } });
      if (reserved) {
        throw slugReservedError();
      }
      const taken = await this.db.site.findFirst({
        where: {
          slug: { equals: slug, mode: 'insensitive' },
          NOT: { id },
        },
        select: { id: true },
      });
      if (taken) {
        throw slugTakenError();
      }
      data.slug = slug;
    }

    if (parsed.data.status !== undefined) {
      data.status = parsed.data.status;
      if (parsed.data.status === 'PUBLISHED') {
        data.publishedAt = existing.publishedAt ?? new Date();
      }
    }

    void nextCustomerId;
    void nextResellerId;

    try {
      const updated = await this.db.site.update({
        where: { id },
        data,
        select: { ...siteSelect, content: true },
      });
      this.byHostCache.invalidateSlug(existing.slug);
      if (updated.slug !== existing.slug) {
        this.byHostCache.invalidateSlug(updated.slug);
      }
      return updated;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw slugTakenError();
      }
      if (error instanceof ConflictException || error instanceof BadRequestException) {
        throw error;
      }
      throw error;
    }
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
