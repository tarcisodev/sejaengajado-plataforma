import {
  AuditLog,
  Cancellation,
  Coupon,
  Customer,
  NoticeLog,
  Order,
  Payment,
  Plan,
  PlatformConfig,
  Plaque,
  PlaqueStock,
  Reseller,
  ResellerGoal,
  ResellerInvoice,
  ResellerPlan,
  ResellerPrice,
  ReservedSlug,
  ScanEvent,
  Site,
  Subscription,
  Template,
  User,
  WebhookEvent,
} from '../core/models/domain';
import { contentForSite } from './site-bios';

export interface MockDatabase {
  users: User[];
  resellers: Reseller[];
  resellerPlans: ResellerPlan[];
  resellerPrices: ResellerPrice[];
  resellerGoals: ResellerGoal[];
  plaqueStock: PlaqueStock[];
  customers: Customer[];
  sites: Site[];
  templates: Template[];
  plans: Plan[];
  platformConfig: PlatformConfig;
  coupons: Coupon[];
  orders: Order[];
  subscriptions: Subscription[];
  payments: Payment[];
  webhookEvents: WebhookEvent[];
  plaques: Plaque[];
  scanEvents: ScanEvent[];
  cancellations: Cancellation[];
  resellerInvoices: ResellerInvoice[];
  notices: NoticeLog[];
  reservedSlugs: ReservedSlug[];
  auditLogs: AuditLog[];
}

export const PLAN_PRONTO = 'plan_pronto';
export const PLAN_PRO = 'plan_pro';
export const PLAN_HOSTING = 'plan_hosting';
export const RESELLER_TRIANGULO = 'res_triangulo';
export const RESELLER_CENTRO = 'res_centro';
export const RESELLER_ATRASADO = 'res_atrasado';
export const SITE_FORNO = 'site_forno';
export const SUB_FORNO = 'sub_forno';

const emptySchema: Record<string, unknown> = { type: 'object' };

export function createUberabaSeed(): MockDatabase {
  const platformConfig: PlatformConfig = {
    notifyFromDias: 1,
    readOnlyDias: 8,
    suspendDias: 16,
    archiveDias: 60,
    prontoRenewalCentavos: 12_900,
    plaqueValueCentavos: 8_000,
    plaquePenaltyPct: 100,
    resellerGraceDays: 30,
  };

  const plans: Plan[] = [
    {
      id: PLAN_PRONTO,
      code: 'PRONTO',
      nome: 'Pronto',
      tipo: 'ONE_TIME',
      precoCentavos: 34_700,
      intervalo: null,
      features: { hostingYearIncluded: true, editable: false },
    },
    {
      id: PLAN_PRO,
      code: 'ENGAJADO_PRO',
      nome: 'Engajado Pro',
      tipo: 'RECURRING',
      precoCentavos: 5_990,
      intervalo: 'MONTH',
      features: { editable: true, giftedPlaque: true },
    },
    {
      id: PLAN_HOSTING,
      code: 'PRONTO_HOSTING',
      nome: 'Renovação anual Pronto',
      tipo: 'ANNUAL_HOSTING',
      precoCentavos: 12_900,
      intervalo: 'YEAR',
      features: {},
    },
  ];

  const templates: Template[] = [
    {
      id: 'tpl_barbearia',
      key: 'barbearia',
      nome: 'Barbearia',
      ramo: 'barbearia',
      schemaType: 'HairSalon',
      schema: emptySchema,
      ativo: true,
    },
    {
      id: 'tpl_restaurante',
      key: 'restaurante',
      nome: 'Restaurante',
      ramo: 'restaurante',
      schemaType: 'Restaurant',
      schema: emptySchema,
      ativo: true,
    },
    {
      id: 'tpl_servicos',
      key: 'servicos',
      nome: 'Serviços',
      ramo: 'servicos',
      schemaType: 'ProfessionalService',
      schema: emptySchema,
      ativo: true,
    },
    {
      id: 'tpl_personalizado',
      key: 'personalizado',
      nome: 'Personalizado',
      ramo: 'personalizado',
      schemaType: 'LocalBusiness',
      schema: emptySchema,
      ativo: true,
    },
  ];

  const users: User[] = [
    { id: 'user_admin', supabaseId: 'sb_admin', email: 'admin@sejaengajado.com.br', role: 'ADMIN' },
    {
      id: 'user_triangulo',
      supabaseId: 'sb_triangulo',
      email: 'triangulo@example.com',
      role: 'RESELLER',
    },
    { id: 'user_centro', supabaseId: 'sb_centro', email: 'centro@example.com', role: 'RESELLER' },
    {
      id: 'user_atrasado',
      supabaseId: 'sb_atrasado',
      email: 'atrasado@example.com',
      role: 'RESELLER',
    },
    { id: 'user_ana', supabaseId: 'sb_ana', email: 'ana@example.com', role: 'CUSTOMER' },
    { id: 'user_ze', supabaseId: 'sb_ze', email: 'ze@example.com', role: 'CUSTOMER' },
    { id: 'user_forno', supabaseId: 'sb_forno', email: 'forno@example.com', role: 'CUSTOMER' },
  ];

  const resellerPlans: ResellerPlan[] = [
    {
      id: 'rp_base',
      nome: 'Revendedor base',
      mensalidadeCentavos: 4_990,
      custoPorSiteAtivoCentavos: 990,
      limiteSites: null,
    },
  ];

  const resellers: Reseller[] = [
    reseller('res_triangulo', 'user_triangulo', 'Placas do Triângulo', 'ACTIVE', null),
    reseller('res_centro', 'user_centro', 'Vitrine Centro', 'ACTIVE', null),
    reseller('res_atrasado', 'user_atrasado', 'Mídias Uberaba', 'DELINQUENT', '2026-09-01'),
  ];

  const customers: Customer[] = [
    customer('cust_admin', null, null, 'Administrador', '34999990000'),
    customer('cust_ze', 'user_ze', null, 'Barbearia do Zé', '34999990001'),
    customer('cust_forno', 'user_forno', null, 'Pizzaria Forno da Praça', '34999990002'),
    customer('cust_ana', 'user_ana', RESELLER_TRIANGULO, 'Salão da Ana', '34999990003'),
    customer('cust_oficina', null, RESELLER_TRIANGULO, 'Oficina do Bairro', '34999990004'),
    customer('cust_mercado', null, RESELLER_CENTRO, 'Lanchonete do Mercado', '34999990005'),
    customer('cust_padaria', null, RESELLER_ATRASADO, 'Padaria São Benedito', '34999990006'),
    customer('cust_arquivo', null, RESELLER_ATRASADO, 'Mercearia do Arquivo', '34999990007'),
    customer('cust_estudio', null, null, 'Estúdio Linha Verde', '34999990008'),
  ];

  const sites: Site[] = [
    site({
      id: 'site_ze',
      customerId: 'cust_ze',
      resellerId: null,
      slug: 'barbearia-do-ze',
      templateId: 'tpl_barbearia',
      businessName: 'Barbearia do Zé',
      status: 'PUBLISHED',
      planId: PLAN_PRONTO,
      editable: false,
      publishedAt: '2026-01-10',
      hostingRenewsAt: '2027-01-10',
      plaqueFidelityEndsAt: null,
    }),
    site({
      id: SITE_FORNO,
      customerId: 'cust_forno',
      resellerId: null,
      slug: 'pizzaria-forno-da-praca',
      templateId: 'tpl_restaurante',
      businessName: 'Pizzaria Forno da Praça',
      status: 'PUBLISHED',
      planId: PLAN_PRO,
      editable: true,
      publishedAt: '2026-06-15',
      hostingRenewsAt: null,
      plaqueFidelityEndsAt: '2027-06-15',
    }),
    site({
      id: 'site_ana',
      customerId: 'cust_ana',
      resellerId: RESELLER_TRIANGULO,
      slug: 'salao-da-ana',
      templateId: 'tpl_barbearia',
      businessName: 'Salão da Ana',
      status: 'PUBLISHED',
      planId: PLAN_PRO,
      editable: true,
      publishedAt: '2026-03-01',
      hostingRenewsAt: null,
      plaqueFidelityEndsAt: '2027-03-01',
    }),
    site({
      id: 'site_leitura',
      customerId: 'cust_ana',
      resellerId: RESELLER_TRIANGULO,
      slug: 'salao-da-ana-unidades',
      templateId: 'tpl_servicos',
      businessName: 'Salão da Ana Unidades',
      status: 'READ_ONLY',
      planId: PLAN_PRO,
      editable: true,
      publishedAt: '2026-04-01',
      hostingRenewsAt: null,
      plaqueFidelityEndsAt: '2027-04-01',
    }),
    site({
      id: 'site_rascunho',
      customerId: 'cust_oficina',
      resellerId: RESELLER_TRIANGULO,
      slug: 'oficina-do-bairro',
      templateId: 'tpl_servicos',
      businessName: 'Oficina do Bairro',
      status: 'DRAFT',
      planId: PLAN_PRONTO,
      editable: false,
      publishedAt: null,
      hostingRenewsAt: null,
      plaqueFidelityEndsAt: null,
    }),
    site({
      id: 'site_suspenso',
      customerId: 'cust_oficina',
      resellerId: RESELLER_TRIANGULO,
      slug: 'oficina-suspensa',
      templateId: 'tpl_servicos',
      businessName: 'Oficina Suspensa',
      status: 'SUSPENDED',
      planId: PLAN_PRO,
      editable: false,
      publishedAt: '2026-02-01',
      hostingRenewsAt: null,
      plaqueFidelityEndsAt: '2027-02-01',
    }),
    site({
      id: 'site_mercado',
      customerId: 'cust_mercado',
      resellerId: RESELLER_CENTRO,
      slug: 'lanchonete-do-mercado',
      templateId: 'tpl_restaurante',
      businessName: 'Lanchonete do Mercado',
      status: 'PUBLISHED',
      planId: PLAN_PRO,
      editable: true,
      publishedAt: '2026-05-01',
      hostingRenewsAt: null,
      plaqueFidelityEndsAt: '2027-05-01',
    }),
    site({
      id: 'site_padaria',
      customerId: 'cust_padaria',
      resellerId: RESELLER_ATRASADO,
      slug: 'padaria-sao-benedito',
      templateId: 'tpl_restaurante',
      businessName: 'Padaria São Benedito',
      status: 'PUBLISHED',
      planId: PLAN_PRONTO,
      editable: false,
      publishedAt: '2026-07-01',
      hostingRenewsAt: '2027-07-01',
      plaqueFidelityEndsAt: null,
    }),
    site({
      id: 'site_arquivo',
      customerId: 'cust_arquivo',
      resellerId: RESELLER_ATRASADO,
      slug: 'mercearia-do-arquivo',
      templateId: 'tpl_servicos',
      businessName: 'Mercearia do Arquivo',
      status: 'ARCHIVED',
      planId: PLAN_PRONTO,
      editable: false,
      publishedAt: '2025-01-01',
      hostingRenewsAt: null,
      plaqueFidelityEndsAt: null,
    }),
    site({
      id: 'site_estudio',
      customerId: 'cust_estudio',
      resellerId: null,
      slug: 'estudio-linha-verde',
      templateId: 'tpl_servicos',
      businessName: 'Estúdio Linha Verde',
      status: 'PUBLISHED',
      planId: PLAN_PRONTO,
      editable: false,
      publishedAt: '2026-08-01',
      hostingRenewsAt: '2027-08-01',
      plaqueFidelityEndsAt: null,
    }),
  ];

  const coupons: Coupon[] = [
    {
      id: 'cup_uberaba10',
      code: 'UBERABA10',
      tipo: 'PCT',
      valor: 10,
      validade: '2026-12-31',
      maxUsos: 50,
      usos: 2,
      planIds: [PLAN_PRONTO, PLAN_PRO],
    },
  ];

  const orders: Order[] = [
    {
      id: 'order_ze',
      customerId: 'cust_ze',
      resellerId: null,
      siteId: 'site_ze',
      planId: PLAN_PRONTO,
      couponId: null,
      valorBruto: 34_700,
      desconto: 0,
      valorLiquido: 34_700,
      status: 'PAID',
    },
  ];

  const subscriptions: Subscription[] = [
    {
      id: SUB_FORNO,
      siteId: SITE_FORNO,
      resellerId: null,
      gateway: 'asaas',
      gatewaySubId: 'sub_sandbox_forno',
      status: 'ACTIVE',
      currentPeriodEnd: '2026-11-15',
    },
  ];

  const payments: Payment[] = [
    {
      id: 'pay_ze',
      orderId: 'order_ze',
      subscriptionId: null,
      resellerId: null,
      gateway: 'asaas',
      gatewayPaymentId: 'pay_sandbox_ze',
      metodo: 'PIX',
      valor: 34_700,
      status: 'PAID',
      paidAt: '2026-01-10',
    },
    {
      id: 'pay_mercado',
      orderId: null,
      subscriptionId: null,
      resellerId: RESELLER_CENTRO,
      gateway: 'asaas',
      gatewayPaymentId: 'pay_sandbox_mercado',
      metodo: 'PIX',
      valor: 5_990,
      status: 'PAID',
      paidAt: '2026-05-01',
    },
  ];

  const resellerPrices: ResellerPrice[] = [
    { resellerId: RESELLER_TRIANGULO, planId: PLAN_PRONTO, precoCentavos: 39_700 },
    { resellerId: RESELLER_TRIANGULO, planId: PLAN_PRO, precoCentavos: 7_990 },
    { resellerId: RESELLER_CENTRO, planId: PLAN_PRO, precoCentavos: 6_990 },
  ];

  const resellerGoals: ResellerGoal[] = [
    { resellerId: RESELLER_TRIANGULO, mes: '2026-10', metaSites: 8, metaReceita: 200_000 },
  ];

  const plaqueStock: PlaqueStock[] = [
    { resellerId: RESELLER_TRIANGULO, tipo: 'QR', qtd: 40, custoMedio: 1_300 },
    { resellerId: RESELLER_TRIANGULO, tipo: 'NFC', qtd: 12, custoMedio: 2_200 },
  ];

  const plaques: Plaque[] = [
    {
      id: 'plaque_forno',
      siteId: SITE_FORNO,
      tipo: 'QR',
      codigo: 'UBA-FORNO-01',
      status: 'ENTREGUE',
      valorCentavos: 8_000,
      giftedBool: true,
    },
  ];

  const scanEvents: ScanEvent[] = [
    { id: 'scan_ze_1', siteId: 'site_ze', ts: '2026-10-01T15:00:00.000Z', ipHash: 'hash_ze_1' },
  ];

  const reservedSlugs: ReservedSlug[] = [
    'www',
    'app',
    'api',
    'admin',
    'mail',
    'login',
    'pix',
    'banco',
    'gov',
  ].map((slug) => ({ slug }));

  return {
    users,
    resellers,
    resellerPlans,
    resellerPrices,
    resellerGoals,
    plaqueStock,
    customers,
    sites,
    templates,
    plans,
    platformConfig,
    coupons,
    orders,
    subscriptions,
    payments,
    webhookEvents: [],
    plaques,
    scanEvents,
    cancellations: [],
    resellerInvoices: [],
    notices: [],
    reservedSlugs,
    auditLogs: [],
  };
}

function reseller(
  id: string,
  userId: string,
  nome: string,
  status: Reseller['status'],
  delinquentSince: string | null,
): Reseller {
  return {
    id,
    userId,
    nome,
    resellerPlanId: 'rp_base',
    status,
    delinquentSince,
    blockedAt: null,
    blockReason: null,
    asaasWalletId: null,
  };
}

function customer(
  id: string,
  userId: string | null,
  resellerId: string | null,
  nome: string,
  whatsapp: string,
): Customer {
  return {
    id,
    userId,
    resellerId,
    nome,
    doc: '00000000000',
    whatsapp,
    cidade: 'Uberaba',
  };
}

function site(input: {
  id: string;
  customerId: string;
  resellerId: string | null;
  slug: string;
  templateId: string;
  businessName: string;
  status: Site['status'];
  planId: string;
  editable: boolean;
  publishedAt: string | null;
  hostingRenewsAt: string | null;
  plaqueFidelityEndsAt: string | null;
}): Site {
  return {
    id: input.id,
    customerId: input.customerId,
    resellerId: input.resellerId,
    slug: input.slug,
    customDomain: null,
    templateId: input.templateId,
    content: contentForSite(input.slug, input.businessName, input.templateId),
    status: input.status,
    planId: input.planId,
    editable: input.editable,
    publishedAt: input.publishedAt,
    hostingRenewsAt: input.hostingRenewsAt,
    plaqueFidelityEndsAt: input.plaqueFidelityEndsAt,
  };
}
