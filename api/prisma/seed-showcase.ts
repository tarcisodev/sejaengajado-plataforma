/**
 * Production-safe showcase seed: only the 3 model biosites.
 * Does NOT touch platform_config, products, plans, reseller_plans, users or prices.
 */
import { Prisma, PrismaClient } from '@prisma/client';

import {
  formulaDemoBarbearia,
  formulaDemoEstudio,
  formulaDemoForno,
} from './showcase-formula-content';

export const SHOWCASE_CUSTOMER_NAME = 'Demonstração Seja Engajado';
export const SHOWCASE_CUSTOMER_EMAIL = 'demo.sites@sejaengajado.com.br';
export const SHOWCASE_CUSTOMER_ID = '00000000-0000-4000-8000-00000000d0c1';

export const SHOWCASE_TEMPLATE_KEYS = ['restaurante', 'barbearia', 'loja-local'] as const;

export const SHOWCASE_SITE_SLUGS = ['demo-forno', 'demo-barbearia', 'demo-estudio'] as const;

type ShowcasePrisma = Pick<
  PrismaClient,
  'reseller' | 'customer' | 'template' | 'plan' | 'site' | 'plaque'
>;

export interface ShowcaseSeedResult {
  ok: true;
  platformResellerId: string;
  customerId: string;
  created: {
    templates: string[];
    customer: boolean;
    sites: string[];
    plaques: string[];
  };
  skipped: {
    templates: string[];
    sites: string[];
  };
  demoSites: { slug: string; url: string }[];
}

function assetBase(): string {
  return (process.env.SEED_DEMO_ASSET_BASE ?? 'https://app.sejaengajado.com.br').replace(
    /\/$/,
    '',
  );
}

async function ensureTemplate(
  db: ShowcasePrisma,
  key: string,
  create: {
    name: string;
    niche: string;
    schemaType: string;
  },
): Promise<{ id: string; created: boolean }> {
  const existing = await db.template.findUnique({ where: { key } });
  if (existing) {
    return { id: existing.id, created: false };
  }
  const row = await db.template.create({
    data: {
      key,
      name: create.name,
      niche: create.niche,
      schemaType: create.schemaType,
      schema: { type: 'object' },
      active: true,
    },
  });
  return { id: row.id, created: true };
}

/** Upsert-by-key that never updates existing rows (create-only). */
export async function upsertTemplateCreateOnly(
  db: ShowcasePrisma,
  key: string,
  create: { name: string; niche: string; schemaType: string },
): Promise<{ id: string; created: boolean }> {
  return ensureTemplate(db, key, create);
}

export async function runShowcaseSeed(db: ShowcasePrisma): Promise<ShowcaseSeedResult> {
  const platform = await db.reseller.findFirst({
    where: { isPlatform: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!platform) {
    throw new Error(
      'seed-showcase: reseller isPlatform não encontrado — abortando (nada foi alterado).',
    );
  }

  const plan =
    (await db.plan.findUnique({ where: { code: 'PRONTO' } })) ??
    (await db.plan.findFirst({ orderBy: { createdAt: 'asc' } }));
  if (!plan) {
    throw new Error(
      'seed-showcase: nenhum Plan existente — abortando (não cria planos/preços).',
    );
  }

  const created = {
    templates: [] as string[],
    customer: false,
    sites: [] as string[],
    plaques: [] as string[],
  };
  const skipped = {
    templates: [] as string[],
    sites: [] as string[],
  };

  const templates = {
    restaurante: await upsertTemplateCreateOnly(db, 'restaurante', {
      name: 'Restaurante / Lanchonete',
      niche: 'restaurante',
      schemaType: 'Restaurant',
    }),
    barbearia: await upsertTemplateCreateOnly(db, 'barbearia', {
      name: 'Salão / Barbearia',
      niche: 'barbearia',
      schemaType: 'HairSalon',
    }),
    loja: await upsertTemplateCreateOnly(db, 'loja-local', {
      name: 'Loja / Serviço local',
      niche: 'generico',
      schemaType: 'LocalBusiness',
    }),
  };
  for (const [key, row] of Object.entries(templates)) {
    const templateKey = key === 'loja' ? 'loja-local' : key;
    if (row.created) {
      created.templates.push(templateKey);
    } else {
      skipped.templates.push(templateKey);
    }
  }

  let customer =
    (await db.customer.findUnique({ where: { id: SHOWCASE_CUSTOMER_ID } })) ??
    (await db.customer.findFirst({
      where: {
        resellerId: platform.id,
        OR: [{ email: SHOWCASE_CUSTOMER_EMAIL }, { name: SHOWCASE_CUSTOMER_NAME }],
      },
    }));

  if (!customer) {
    customer = await db.customer.create({
      data: {
        id: SHOWCASE_CUSTOMER_ID,
        resellerId: platform.id,
        name: SHOWCASE_CUSTOMER_NAME,
        doc: '',
        whatsapp: '5534999990000',
        city: 'Uberaba',
        email: SHOWCASE_CUSTOMER_EMAIL,
      },
    });
    created.customer = true;
  }

  const base = assetBase();
  const models = [
    {
      slug: 'demo-forno' as const,
      templateId: templates.restaurante.id,
      content: formulaDemoForno(base),
    },
    {
      slug: 'demo-barbearia' as const,
      templateId: templates.barbearia.id,
      content: formulaDemoBarbearia(base),
    },
    {
      slug: 'demo-estudio' as const,
      templateId: templates.loja.id,
      content: formulaDemoEstudio(base),
    },
  ];

  for (const model of models) {
    const existing = await db.site.findFirst({ where: { slug: model.slug } });
    if (existing) {
      if (existing.isDemo) {
        await db.site.update({
          where: { id: existing.id },
          data: {
            customerId: customer.id,
            resellerId: platform.id,
            templateId: model.templateId,
            planId: plan.id,
            status: 'PUBLISHED',
            editable: false,
            isDemo: true,
            content: model.content as Prisma.InputJsonValue,
            publishedAt: existing.publishedAt ?? new Date(),
          },
        });
      }
      skipped.sites.push(model.slug);
      const plaqueExisting = await db.plaque.findFirst({
        where: { siteId: existing.id, type: 'QR' },
      });
      if (!plaqueExisting) {
        await db.plaque.create({
          data: {
            resellerId: platform.id,
            siteId: existing.id,
            type: 'QR',
            status: 'DELIVERED',
          },
        });
        created.plaques.push(model.slug);
      }
      continue;
    }

    const site = await db.site.create({
      data: {
        customerId: customer.id,
        resellerId: platform.id,
        slug: model.slug,
        templateId: model.templateId,
        planId: plan.id,
        status: 'PUBLISHED',
        editable: false,
        isDemo: true,
        content: model.content as Prisma.InputJsonValue,
        publishedAt: new Date(),
      },
    });
    created.sites.push(site.slug);

    const plaqueExisting = await db.plaque.findFirst({
      where: { siteId: site.id, type: 'QR' },
    });
    if (!plaqueExisting) {
      await db.plaque.create({
        data: {
          resellerId: platform.id,
          siteId: site.id,
          type: 'QR',
          status: 'DELIVERED',
        },
      });
      created.plaques.push(site.slug);
    }
  }

  return {
    ok: true,
    platformResellerId: platform.id,
    customerId: customer.id,
    created,
    skipped,
    demoSites: SHOWCASE_SITE_SLUGS.map((slug) => ({
      slug,
      url: `https://${slug}.sejaengajado.com.br`,
    })),
  };
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const result = await runShowcaseSeed(prisma);
    console.log(JSON.stringify({ ...result, note: 'isDemo=true — fora de cobrança/métricas' }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

const isMain =
  typeof require !== 'undefined' &&
  typeof module !== 'undefined' &&
  require.main === module;

if (isMain) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
