import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { decodeTimeIdCursor, encodeTimeIdCursor, paginate } from '../../common/cursor';
import { ByHostCache } from '../../public/sites/by-host.cache';
import { PRISMA, type TenantPrisma } from '../../tenant/prisma.module';
import { assertResellerOperable } from '../reseller-status';
import {
  buildPsychologyStarterContent,
  defaultSiteContent,
  mergeSiteContent,
  siteContentSchema,
} from './site-content.schema';
import {
  assertSlugFormat,
  assertSlugNotBrand,
  normalizeSlug,
  slugReservedError,
  slugTakenError,
} from './slug';

export const createSiteSchema = z.object({
  customerId: z.string().uuid(),
  slug: z.string().min(1),
  templateId: z.string().uuid(),
  planId: z.string().uuid(),
  content: siteContentSchema.optional(),
});

export const patchSiteSchema = z.object({
  slug: z.string().min(1).optional(),
  templateId: z.string().uuid().optional(),
  planId: z.string().uuid().optional(),
  /** Validated after the optional merge (see `merge`). */
  content: z.unknown().optional(),
  /** true = shallow-merge top-level keys into stored content (wizard step drafts). */
  merge: z.boolean().optional(),
});

@Injectable()
export class SitesService {
  constructor(
    @Inject(PRISMA) private readonly db: TenantPrisma,
    private readonly byHostCache: ByHostCache,
  ) {}

  private async loadReseller(resellerId: string) {
    const reseller = await this.db.reseller.findUnique({
      where: { id: resellerId },
      include: { plan: true },
    });
    if (!reseller) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Recurso não encontrado' });
    }
    return reseller;
  }

  private parseContent(raw: unknown) {
    const parsed = siteContentSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Dados inválidos',
        fields: parsed.error.issues.map((issue) => ({
          path: ['content', ...issue.path].join('.'),
          code: issue.code,
          message: issue.message,
        })),
      });
    }
    return parsed.data;
  }

  private async assertSlugAvailable(slug: string, excludeId?: string) {
    assertSlugFormat(slug);
    assertSlugNotBrand(slug);

    const reserved = await this.db.reservedSlug.findUnique({ where: { slug } });
    if (reserved) {
      throw slugReservedError();
    }

    const taken = await this.db.site.findFirst({
      where: {
        slug: { equals: slug, mode: 'insensitive' },
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (taken) {
      throw slugTakenError();
    }
  }

  private async assertSiteLimit(resellerId: string, siteLimit: number | null) {
    if (siteLimit == null) {
      return;
    }
    const count = await this.db.site.count({ where: { resellerId } });
    if (count >= siteLimit) {
      throw new ForbiddenException({
        code: 'SITE_LIMIT_REACHED',
        message: 'Limite de sites atingido',
      });
    }
  }

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
      include: { customer: true, plan: true, template: true },
    });
    return paginate(rows, limit, (row) => encodeTimeIdCursor(row.createdAt, row.id));
  }

  async get(id: string) {
    const row = await this.db.site.findUnique({
      where: { id },
      include: { customer: true, plan: true, template: true },
    });
    if (!row) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Recurso não encontrado' });
    }
    return row;
  }

  async checkSlug(raw: string) {
    const slug = normalizeSlug(raw ?? '');
    try {
      await this.assertSlugAvailable(slug);
      return { slug, available: true };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ConflictException) {
        const response = error.getResponse() as { code?: string };
        return {
          slug,
          available: false,
          code: response.code ?? 'SLUG_INVALID',
        };
      }
      throw error;
    }
  }

  /** Planos e templates ativos para o formulário de criar site (não são tenant-scoped). */
  async siteOptions() {
    await this.ensurePsychologyTemplate();
    const [plans, templates] = await Promise.all([
      this.db.plan.findMany({
        orderBy: { code: 'asc' },
        select: { id: true, code: true, name: true, type: true, priceCents: true },
      }),
      this.db.template.findMany({
        where: { active: true },
        orderBy: { name: 'asc' },
        select: { id: true, key: true, name: true, niche: true },
      }),
    ]);
    return { plans, templates };
  }

  private async ensurePsychologyTemplate(): Promise<void> {
    if (!this.db.template?.findUnique || !this.db.template?.create) {
      return;
    }
    try {
      const existing = await this.db.template.findUnique({
        where: { key: 'psicologia-clinica' },
        select: { id: true },
      });
      if (!existing) {
        await this.db.template.create({
          data: {
            key: 'psicologia-clinica',
            name: 'Psicologia / Clínica & Terapia',
            niche: 'saude',
            schemaType: 'MedicalClinic',
            schema: { type: 'object' },
            active: true,
          },
        });
      }
    } catch {
      /* ignore race or read-only test mocks */
    }
  }

  async create(resellerId: string, body: unknown) {
    const reseller = await this.loadReseller(resellerId);
    assertResellerOperable(reseller.status);
    await this.assertSiteLimit(resellerId, reseller.plan.siteLimit);

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

    const slug = normalizeSlug(parsed.data.slug);
    await this.assertSlugAvailable(slug);

    const customer = await this.db.customer.findUnique({
      where: { id: parsed.data.customerId },
    });
    if (!customer) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Recurso não encontrado' });
    }

    const template = this.db.template?.findUnique
      ? await this.db.template
          .findUnique({
            where: { id: parsed.data.templateId },
            select: { key: true, niche: true },
          })
          .catch(() => null)
      : null;

    const isPsychologyOrHealth =
      template?.key === 'psicologia-clinica' ||
      template?.niche === 'saude' ||
      parsed.data.content?.theme?.niche === 'saude';

    const rawContent = parsed.data.content as Record<string, unknown> | undefined;
    const hasCustomProducts =
      Array.isArray(rawContent?.products) && rawContent.products.length > 0;
    const hasCustomServicos =
      Array.isArray(rawContent?.servicos) && rawContent.servicos.length > 0;

    const content =
      isPsychologyOrHealth && !hasCustomProducts && !hasCustomServicos
        ? buildPsychologyStarterContent({
            businessName:
              (typeof rawContent?.businessName === 'string' && rawContent.businessName) ||
              customer.name,
            city: customer.city || undefined,
            whatsapp: customer.whatsapp || undefined,
            email: customer.email || undefined,
            existing: rawContent,
          })
        : parsed.data.content
          ? this.parseContent(parsed.data.content)
          : defaultSiteContent();

    try {
      const site = await this.db.site.create({
        data: {
          resellerId,
          customerId: parsed.data.customerId,
          slug,
          templateId: parsed.data.templateId,
          planId: parsed.data.planId,
          status: 'DRAFT',
          editable: true,
          content: content as Prisma.InputJsonValue,
        },
        include: { customer: true, plan: true, template: true },
      });
      return site;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw slugTakenError();
      }
      throw error;
    }
  }

  async update(id: string, body: unknown) {
    const existing = await this.get(id);
    if (!existing.editable || existing.status === 'READ_ONLY') {
      throw new ForbiddenException({
        code: 'SITE_NOT_EDITABLE',
        message: 'Este site está em modo só leitura.',
      });
    }

    const parsed = patchSiteSchema.safeParse(body);
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
    if (parsed.data.slug !== undefined) {
      const slug = normalizeSlug(parsed.data.slug);
      await this.assertSlugAvailable(slug, id);
      data.slug = slug;
    }
    if (parsed.data.templateId !== undefined) {
      data.template = { connect: { id: parsed.data.templateId } };
    }
    if (parsed.data.planId !== undefined) {
      data.plan = { connect: { id: parsed.data.planId } };
    }
    if (parsed.data.content !== undefined) {
      const raw = parsed.data.merge
        ? mergeSiteContent(existing.content, parsed.data.content)
        : parsed.data.content;
      data.content = this.parseContent(raw) as Prisma.InputJsonValue;
    }

    try {
      const updated = await this.db.site.update({
        where: { id },
        data,
        include: { customer: true, plan: true, template: true },
      });
      this.byHostCache.invalidateSlug(existing.slug);
      if (updated.slug !== existing.slug) {
        this.byHostCache.invalidateSlug(updated.slug);
      }
      return updated;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw slugTakenError();
      }
      throw error;
    }
  }

  /** Soft-archive (FLUXO-FELIZ: excluir = arquivar). */
  async remove(id: string) {
    const existing = await this.get(id);
    const updated = await this.db.site.update({
      where: { id },
      data: { status: 'ARCHIVED' },
      include: { customer: true, plan: true, template: true },
    });
    this.byHostCache.invalidateSlug(existing.slug);
    return updated;
  }

  async publish(resellerId: string, id: string) {
    const reseller = await this.loadReseller(resellerId);
    assertResellerOperable(reseller.status);

    const site = await this.get(id);
    if (!site.editable && site.status !== 'PUBLISHED') {
      throw new ForbiddenException({
        code: 'SITE_NOT_EDITABLE',
        message: 'Este site está em modo só leitura.',
      });
    }

    this.parseContent(site.content);

    const updated = await this.db.site.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: site.publishedAt ?? new Date(),
      },
      include: { customer: true, plan: true, template: true },
    });
    this.byHostCache.invalidateSlug(updated.slug);
    return updated;
  }

  async unpublish(id: string) {
    const site = await this.get(id);
    const updated = await this.db.site.update({
      where: { id },
      data: { status: 'DRAFT' },
      include: { customer: true, plan: true, template: true },
    });
    this.byHostCache.invalidateSlug(site.slug);
    return updated;
  }
}
