/**
 * Demo seed for Marco 1 (M1).
 * Prices are DEMO placeholders (P6) — UI must show "valor de exemplo".
 * No real customer/payment data.
 */
import { PrismaClient, ProductCode, UserRole } from '@prisma/client';

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

  console.log(
    JSON.stringify(
      {
        ok: true,
        demo: true,
        adminEmail,
        demoResellerEmail: demoEmail,
        note: 'Preços DEMO (placeholders P6). UI deve exibir selo valor de exemplo.',
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
