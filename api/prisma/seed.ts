import { PrismaClient, ProductCode, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

const RESERVED_SLUGS = [
  'www',
  'app',
  'api',
  'admin',
  'mail',
  'login',
  'pix',
  'banco',
  'gov',
  'sejaengajado',
  'static',
  'cdn',
  'img',
  'status',
];

const PRODUCTS: { code: ProductCode; name: string; baseWholesaleCents: number }[] = [
  { code: 'SITE_ONE_TIME', name: 'Site Pronto', baseWholesaleCents: 4_900 },
  { code: 'SITE_PRO', name: 'Site Engajado Pro', baseWholesaleCents: 2_900 },
  { code: 'PLAQUE_QR', name: 'Placa QR', baseWholesaleCents: 1_500 },
  { code: 'PLAQUE_NFC', name: 'Placa NFC', baseWholesaleCents: 2_500 },
  { code: 'RENEWAL', name: 'Renovação anual Pronto', baseWholesaleCents: 1_900 },
];

async function main(): Promise<void> {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? 'admin@sejaengajado.com.br').toLowerCase();

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
    update: {},
  });

  for (const slug of RESERVED_SLUGS) {
    await prisma.reservedSlug.upsert({
      where: { slug },
      create: { slug },
      update: {},
    });
  }

  const plan = await prisma.resellerPlan.upsert({
    where: { id: '00000000-0000-4000-8000-000000000001' },
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Revendedor base',
      monthlyFeeCents: 4_990,
      siteLimit: null,
    },
    update: {
      name: 'Revendedor base',
      monthlyFeeCents: 4_990,
      siteLimit: null,
    },
  });

  /** Plano Fundador (produção / go-live) — id estável usado pelo admin ao convidar. */
  await prisma.resellerPlan.upsert({
    where: { id: '00000000-0000-4000-8000-000000000002' },
    create: {
      id: '00000000-0000-4000-8000-000000000002',
      name: 'Fundador',
      monthlyFeeCents: 0,
      siteLimit: null,
    },
    update: {
      name: 'Fundador',
      monthlyFeeCents: 0,
      siteLimit: null,
    },
  });

  const platform = await prisma.reseller.upsert({
    where: { id: '00000000-0000-4000-8000-000000000010' },
    create: {
      id: '00000000-0000-4000-8000-000000000010',
      name: 'Plataforma',
      isPlatform: true,
      resellerPlanId: plan.id,
      status: 'ACTIVE',
    },
    update: {
      name: 'Plataforma',
      isPlatform: true,
      resellerPlanId: plan.id,
    },
  });

  await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      supabaseId: process.env.SEED_ADMIN_SUPABASE_ID ?? '00000000-0000-4000-8000-000000000099',
      email: adminEmail,
      role: UserRole.ADMIN,
      status: 'ACTIVE',
    },
    update: {
      role: UserRole.ADMIN,
      status: 'ACTIVE',
    },
  });

  const sampleResellers = [
    {
      id: '00000000-0000-4000-8000-000000000011',
      name: 'Placas do Triângulo',
      email: 'triangulo@example.com',
      supabaseId: '00000000-0000-4000-8000-000000000021',
    },
    {
      id: '00000000-0000-4000-8000-000000000012',
      name: 'Vitrine Centro',
      email: 'centro@example.com',
      supabaseId: '00000000-0000-4000-8000-000000000022',
    },
  ];

  for (const sample of sampleResellers) {
    await prisma.reseller.upsert({
      where: { id: sample.id },
      create: {
        id: sample.id,
        name: sample.name,
        resellerPlanId: plan.id,
        status: 'ACTIVE',
        isPlatform: false,
      },
      update: {
        name: sample.name,
        resellerPlanId: plan.id,
      },
    });
    await prisma.user.upsert({
      where: { email: sample.email },
      create: {
        supabaseId: sample.supabaseId,
        email: sample.email,
        role: UserRole.RESELLER,
        resellerId: sample.id,
        status: 'ACTIVE',
      },
      update: {
        role: UserRole.RESELLER,
        resellerId: sample.id,
        status: 'ACTIVE',
      },
    });
  }

  for (const product of PRODUCTS) {
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
    where: { key: 'personalizado' },
    create: {
      key: 'personalizado',
      name: 'Personalizado',
      niche: 'generico',
      schemaType: 'LocalBusiness',
      schema: { type: 'object' },
      active: true,
    },
    update: {
      name: 'Personalizado',
      niche: 'generico',
      active: true,
    },
  });

  for (const template of [
    {
      key: 'restaurante',
      name: 'Restaurante / Lanchonete',
      niche: 'restaurante',
      schemaType: 'Restaurant',
    },
    {
      key: 'barbearia',
      name: 'Salão / Barbearia',
      niche: 'barbearia',
      schemaType: 'HairSalon',
    },
    {
      key: 'loja-local',
      name: 'Loja / Serviço local',
      niche: 'generico',
      schemaType: 'LocalBusiness',
    },
    {
      key: 'psicologia-clinica',
      name: 'Psicologia / Clínica & Terapia',
      niche: 'saude',
      schemaType: 'MedicalClinic',
    },
  ] as const) {
    await prisma.template.upsert({
      where: { key: template.key },
      create: {
        ...template,
        schema: { type: 'object' },
        active: true,
      },
      update: {
        name: template.name,
        niche: template.niche,
        schemaType: template.schemaType,
        active: true,
      },
    });
  }

  await prisma.plan.upsert({
    where: { code: 'PRONTO' },
    create: {
      code: 'PRONTO',
      name: 'Pronto',
      type: 'ONE_TIME',
      priceCents: 29_900,
      interval: null,
      features: {},
    },
    update: {
      name: 'Pronto',
      priceCents: 29_900,
    },
  });

  await prisma.plan.upsert({
    where: { code: 'ENGAJADO_PRO' },
    create: {
      code: 'ENGAJADO_PRO',
      name: 'Engajado Pro',
      type: 'RECURRING',
      priceCents: 49_900,
      interval: 'MONTH',
      features: {},
    },
    update: {
      name: 'Engajado Pro',
      priceCents: 49_900,
    },
  });

  // Touch platform so the seed always references the reserved reseller.
  await prisma.reseller.update({
    where: { id: platform.id },
    data: { updatedAt: new Date() },
  });
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
