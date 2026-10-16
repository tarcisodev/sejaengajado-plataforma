/**
 * Demo seed for Marco 1 (M1).
 * Prices are DEMO placeholders (P6) — UI must show "valor de exemplo".
 * No real customer/payment data.
 */
import { Prisma, PrismaClient, ProductCode, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

/** DEMO placeholder wholesale (centavos) — not production prices. */
const DEMO_PRODUCTS: { code: ProductCode; name: string; baseWholesaleCents: number }[] = [
  { code: 'SITE_ONE_TIME', name: 'Site Pronto (DEMO)', baseWholesaleCents: 4_900 },
  { code: 'SITE_PRO', name: 'Site Engajado Pro (DEMO)', baseWholesaleCents: 2_900 },
  { code: 'PLAQUE_QR', name: 'Placa QR (DEMO)', baseWholesaleCents: 1_500 },
  { code: 'PLAQUE_NFC', name: 'Placa NFC (DEMO)', baseWholesaleCents: 2_500 },
  { code: 'RENEWAL', name: 'Renovação anual Pronto (DEMO)', baseWholesaleCents: 1_900 },
];

const DEMO_RESELLER_ID = '00000000-0000-4000-8000-00000000d001';
const DEMO_PLAN_ID = '00000000-0000-4000-8000-00000000d002';
const DEMO_USER_ID = '00000000-0000-4000-8000-00000000d003';

async function main(): Promise<void> {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? 'admin@sejaengajado.com.br').toLowerCase();
  const demoEmail = (process.env.SEED_DEMO_RESELLER_EMAIL ?? 'demo.revenda@example.com').toLowerCase();

  await prisma.platformConfig.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      warningDays: 7,
      readOnlyDays: 8,
      suspendDays: 16,
      archiveDays: 60,
      resellerGraceDays: 30,
      prontoRenewalCents: 12_900,
      plaqueValueCents: 9_900,
      plaquePenaltyPct: 100,
    },
    update: {
      // Keep DEMO placeholders visible in admin config screens.
      prontoRenewalCents: 12_900,
      plaqueValueCents: 9_900,
      plaquePenaltyPct: 100,
    },
  });

  const plan = await prisma.resellerPlan.upsert({
    where: { id: DEMO_PLAN_ID },
    create: {
      id: DEMO_PLAN_ID,
      name: 'Plano DEMO',
      monthlyFeeCents: 4_990,
      siteLimit: 50,
    },
    update: {
      name: 'Plano DEMO',
      monthlyFeeCents: 4_990,
      siteLimit: 50,
    },
  });

  await prisma.reseller.upsert({
    where: { id: '00000000-0000-4000-8000-000000000010' },
    create: {
      id: '00000000-0000-4000-8000-000000000010',
      name: 'Plataforma',
      isPlatform: true,
      resellerPlanId: plan.id,
      status: 'ACTIVE',
    },
    update: { name: 'Plataforma', isPlatform: true },
  });

  await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      supabaseId: process.env.SEED_ADMIN_SUPABASE_ID ?? '00000000-0000-4000-8000-000000000099',
      email: adminEmail,
      role: UserRole.ADMIN,
      status: 'ACTIVE',
    },
    update: { role: UserRole.ADMIN, status: 'ACTIVE' },
  });

  await prisma.reseller.upsert({
    where: { id: DEMO_RESELLER_ID },
    create: {
      id: DEMO_RESELLER_ID,
      name: 'Revenda Demo (exemplo)',
      resellerPlanId: plan.id,
      status: 'ACTIVE',
      isPlatform: false,
    },
    update: {
      name: 'Revenda Demo (exemplo)',
      resellerPlanId: plan.id,
      status: 'ACTIVE',
    },
  });

  await prisma.user.upsert({
    where: { email: demoEmail },
    create: {
      id: DEMO_USER_ID,
      supabaseId: process.env.SEED_DEMO_RESELLER_SUPABASE_ID ?? DEMO_USER_ID,
      email: demoEmail,
      role: UserRole.RESELLER,
      resellerId: DEMO_RESELLER_ID,
      status: 'ACTIVE',
    },
    update: {
      role: UserRole.RESELLER,
      resellerId: DEMO_RESELLER_ID,
      status: 'ACTIVE',
    },
  });

  for (const product of DEMO_PRODUCTS) {
    await prisma.product.upsert({
      where: { code: product.code },
      create: product,
      update: {
        name: product.name,
        baseWholesaleCents: product.baseWholesaleCents,
      },
    });
  }

  await prisma.template.upsert({
    where: { key: 'generico' },
    create: {
      key: 'generico',
      name: 'Genérico (DEMO)',
      niche: 'generico',
      schemaType: 'LocalBusiness',
      schema: { type: 'object' },
      active: true,
    },
    update: { name: 'Genérico (DEMO)', active: true, niche: 'generico' },
  });

  await prisma.plan.upsert({
    where: { code: 'PRONTO' },
    create: {
      code: 'PRONTO',
      name: 'Pronto (DEMO)',
      type: 'ONE_TIME',
      priceCents: 29_900,
      interval: null,
      features: { demo: true },
    },
    update: { name: 'Pronto (DEMO)', priceCents: 29_900, features: { demo: true } },
  });

  await prisma.plan.upsert({
    where: { code: 'ENGAJADO_PRO' },
    create: {
      code: 'ENGAJADO_PRO',
      name: 'Engajado Pro (DEMO)',
      type: 'RECURRING',
      priceCents: 49_900,
      interval: 'MONTH',
      features: { demo: true },
    },
    update: { name: 'Engajado Pro (DEMO)', priceCents: 49_900, features: { demo: true } },
  });

  const platformId = '00000000-0000-4000-8000-000000000010';
  const demoCustomerId = '00000000-0000-4000-8000-00000000d0c1';
  const assetBase =
    (process.env.SEED_DEMO_ASSET_BASE ?? 'https://app.sejaengajado.com.br').replace(/\/$/, '');

  const templates = {
    restaurante: await prisma.template.upsert({
      where: { key: 'restaurante' },
      create: {
        key: 'restaurante',
        name: 'Restaurante / Lanchonete',
        niche: 'restaurante',
        schemaType: 'Restaurant',
        schema: { type: 'object' },
        active: true,
      },
      update: { name: 'Restaurante / Lanchonete', niche: 'restaurante', active: true },
    }),
    barbearia: await prisma.template.upsert({
      where: { key: 'barbearia' },
      create: {
        key: 'barbearia',
        name: 'Salão / Barbearia',
        niche: 'barbearia',
        schemaType: 'HairSalon',
        schema: { type: 'object' },
        active: true,
      },
      update: { name: 'Salão / Barbearia', niche: 'barbearia', active: true },
    }),
    loja: await prisma.template.upsert({
      where: { key: 'loja-local' },
      create: {
        key: 'loja-local',
        name: 'Loja / Serviço local',
        niche: 'generico',
        schemaType: 'LocalBusiness',
        schema: { type: 'object' },
        active: true,
      },
      update: { name: 'Loja / Serviço local', niche: 'generico', active: true },
    }),
  };

  const pronto = await prisma.plan.findUniqueOrThrow({ where: { code: 'PRONTO' } });

  await prisma.customer.upsert({
    where: { id: demoCustomerId },
    create: {
      id: demoCustomerId,
      resellerId: platformId,
      name: 'Demonstração Seja Engajado',
      doc: '',
      whatsapp: '5534999990000',
      city: 'Uberaba',
      email: 'demo.sites@sejaengajado.com.br',
    },
    update: {
      name: 'Demonstração Seja Engajado',
      resellerId: platformId,
      city: 'Uberaba',
    },
  });

  const models = [
    {
      slug: 'demo-forno',
      templateId: templates.restaurante.id,
      sample: 'forno.svg',
      content: {
        theme: { niche: 'restaurante', brandColor: '#c2410c' },
        businessName: 'Forno da Praça',
        profile: {
          nome: 'Forno da Praça',
          slogan: 'Pães e lanches frescos todo dia',
          logoUrl: `${assetBase}/samples/forno.svg`,
          cidade: 'Uberaba',
          uf: 'MG',
          tags: ['padaria', 'lanche', 'café'],
        },
        pix: { key: 'forno@demo.sejaengajado.com.br', receiverName: 'Forno da Praça' },
        googleReviewUrl: 'https://g.page/r/demo-forno',
        catalog: { layout: 'grid' },
        strip: { enabled: true, motif: 'pizza', speed: 'normal', direction: 'left' },
        faq: [
          {
            question: 'Fazem entrega?',
            answer: 'Sim, no centro de Uberaba das 10h às 20h.',
          },
        ],
        timezone: 'America/Sao_Paulo',
      },
    },
    {
      slug: 'demo-barbearia',
      templateId: templates.barbearia.id,
      sample: 'barbearia.svg',
      content: {
        theme: { niche: 'barbearia', brandColor: '#1e3a5f' },
        businessName: 'Barbearia do Centro',
        profile: {
          nome: 'Barbearia do Centro',
          slogan: 'Corte, barba e cuidado masculino',
          logoUrl: `${assetBase}/samples/barbearia.svg`,
          cidade: 'Uberaba',
          uf: 'MG',
          tags: ['corte', 'barba', 'barbearia'],
        },
        pix: { key: 'barbearia@demo.sejaengajado.com.br', receiverName: 'Barbearia do Centro' },
        googleReviewUrl: 'https://g.page/r/demo-barbearia',
        catalog: { layout: 'list' },
        strip: { enabled: true, motif: 'tesoura', speed: 'slow', direction: 'left' },
        faq: [
          {
            question: 'Aceitam encaixe?',
            answer: 'Sim, conforme agenda do dia. Prefira agendar pelo WhatsApp.',
          },
        ],
        timezone: 'America/Sao_Paulo',
      },
    },
    {
      slug: 'demo-estudio',
      templateId: templates.loja.id,
      sample: 'estudio.svg',
      content: {
        theme: { niche: 'generico', brandColor: '#0f766e' },
        businessName: 'Estúdio Luz Local',
        profile: {
          nome: 'Estúdio Luz Local',
          slogan: 'Fotos e serviços para o seu negócio',
          logoUrl: `${assetBase}/samples/estudio.svg`,
          cidade: 'Uberaba',
          uf: 'MG',
          tags: ['foto', 'estúdio', 'serviço'],
        },
        pix: { key: 'estudio@demo.sejaengajado.com.br', receiverName: 'Estúdio Luz Local' },
        googleReviewUrl: 'https://g.page/r/demo-estudio',
        catalog: { layout: 'grid' },
        strip: { enabled: false, motif: 'none', speed: 'normal', direction: 'left' },
        faq: [
          {
            question: 'Atendem empresas?',
            answer: 'Sim — ensaio de produto, equipe e fachada.',
          },
        ],
        timezone: 'America/Sao_Paulo',
      },
    },
  ] as const;

  const seededSlugs: string[] = [];
  for (const model of models) {
    const existing = await prisma.site.findFirst({ where: { slug: model.slug } });
    const site = existing
      ? await prisma.site.update({
          where: { id: existing.id },
          data: {
            customerId: demoCustomerId,
            resellerId: platformId,
            templateId: model.templateId,
            planId: pronto.id,
            status: 'PUBLISHED',
            editable: false,
            isDemo: true,
            content: model.content as Prisma.InputJsonValue,
            publishedAt: existing.publishedAt ?? new Date(),
            hostingRenewsAt: null,
          },
        })
      : await prisma.site.create({
          data: {
            customerId: demoCustomerId,
            resellerId: platformId,
            slug: model.slug,
            templateId: model.templateId,
            planId: pronto.id,
            status: 'PUBLISHED',
            editable: false,
            isDemo: true,
            content: model.content as Prisma.InputJsonValue,
            publishedAt: new Date(),
          },
        });

    const plaqueExisting = await prisma.plaque.findFirst({
      where: { siteId: site.id, type: 'QR' },
    });
    if (!plaqueExisting) {
      await prisma.plaque.create({
        data: {
          resellerId: platformId,
          siteId: site.id,
          type: 'QR',
          status: 'DELIVERED',
        },
      });
    }
    seededSlugs.push(site.slug);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        demo: true,
        adminEmail,
        demoResellerEmail: demoEmail,
        demoSites: seededSlugs.map((slug) => ({
          slug,
          url: `https://${slug}.sejaengajado.com.br`,
        })),
        note: 'Preços DEMO (placeholders P6). Sites isDemo=true fora de cobrança/métricas.',
      },
      null,
      2,
    ),
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
