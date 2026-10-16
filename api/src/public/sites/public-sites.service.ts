import {
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';

import { SYSTEM_PRISMA, type SystemPrisma } from '../../tenant/prisma.module';
import { AvaliarRateLimit, hashClientIp } from './avaliar-rate-limit';
import { ByHostCache } from './by-host.cache';
import { parseTenantSlugFromHost } from './host';

export interface PublicSiteBody {
  slug: string;
  status: string;
  templateKey: string;
  /** JSON-LD type from Template — public tenants must not call /admin/templates. */
  schemaType: string;
  content: unknown;
  temporarilyUnavailable: boolean;
}

@Injectable()
export class PublicSitesService {
  constructor(
    @Inject(SYSTEM_PRISMA) private readonly db: SystemPrisma,
    private readonly cache: ByHostCache,
    private readonly avaliarLimit: AvaliarRateLimit,
  ) {}

  async byHost(rawHost: string | undefined): Promise<{
    body: PublicSiteBody;
    etag: string;
    fromCache: boolean;
  }> {
    const slug = parseTenantSlugFromHost(rawHost);
    if (!slug) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Site não encontrado',
      });
    }

    const cacheKey = (rawHost ?? '').trim().toLowerCase().split(':')[0] ?? slug;
    const hit = this.cache.get(cacheKey);
    if (hit) {
      return {
        body: hit.body as PublicSiteBody,
        etag: hit.etag,
        fromCache: true,
      };
    }

    const site = await this.db.site.findFirst({
      where: { slug: { equals: slug, mode: 'insensitive' } },
      include: { template: true },
    });
    if (!site) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Site não encontrado',
      });
    }
    if (site.status === 'ARCHIVED') {
      throw new GoneException({
        code: 'GONE',
        message: 'Site arquivado',
      });
    }
    if (site.status === 'DRAFT') {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Site não encontrado',
      });
    }

    const body: PublicSiteBody = {
      slug: site.slug,
      status: site.status,
      templateKey: site.template.key,
      schemaType: site.template.schemaType || 'LocalBusiness',
      content: site.content,
      temporarilyUnavailable: site.status === 'SUSPENDED',
    };
    const etag = weakEtag(body);
    this.cache.set(cacheKey, body, etag);
    // Also index by slug host forms used on invalidation.
    this.cache.set(`${site.slug}.sejaengajado.com.br`, body, etag);
    return { body, etag, fromCache: false };
  }

  async reviewRedirect(slugRaw: string, ip: string | undefined): Promise<string> {
    const ipHash = hashClientIp(ip ?? 'unknown');
    this.avaliarLimit.assertAllowed(ipHash);

    const slug = slugRaw.trim().toLowerCase();
    const site = await this.db.site.findFirst({
      where: {
        slug: { equals: slug, mode: 'insensitive' },
        status: { in: ['PUBLISHED', 'READ_ONLY', 'SUSPENDED'] },
      },
    });
    if (!site) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Site não encontrado',
      });
    }

    const content = site.content as { googleReviewUrl?: unknown };
    const url =
      typeof content.googleReviewUrl === 'string' && content.googleReviewUrl
        ? content.googleReviewUrl
        : null;
    if (!url) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Link de avaliação indisponível',
      });
    }

    if (this.avaliarLimit.shouldRecordScan(site.id, ipHash)) {
      await this.db.scanEvent.create({
        data: {
          siteId: site.id,
          ipHash,
        },
      });
    }

    return url;
  }
}

function weakEtag(body: unknown): string {
  const digest = createHash('sha1').update(JSON.stringify(body)).digest('hex');
  return `W/"${digest}"`;
}
