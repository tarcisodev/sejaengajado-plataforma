import {
  AuditLog,
  Coupon,
  Plan,
  PlatformConfig,
  Reseller,
  ResellerPlan,
} from '../models/domain';

/** API platform config (*Days / *Cents) → domain pt-BR. */
export function mapPlatformConfig(row: Record<string, unknown>): PlatformConfig {
  return {
    notifyFromDias: Number(row['warningDays'] ?? 0),
    readOnlyDias: Number(row['readOnlyDays'] ?? 0),
    suspendDias: Number(row['suspendDays'] ?? 0),
    archiveDias: Number(row['archiveDays'] ?? 0),
    prontoRenewalCentavos: Number(row['prontoRenewalCents'] ?? 0),
    plaqueValueCentavos: Number(row['plaqueValueCents'] ?? 0),
    plaquePenaltyPct: Number(row['plaquePenaltyPct'] ?? 0),
    resellerGraceDays: Number(row['resellerGraceDays'] ?? 30),
  };
}

export function toApiPlatformConfig(patch: Partial<PlatformConfig>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (patch.notifyFromDias !== undefined) body['warningDays'] = patch.notifyFromDias;
  if (patch.readOnlyDias !== undefined) body['readOnlyDays'] = patch.readOnlyDias;
  if (patch.suspendDias !== undefined) body['suspendDays'] = patch.suspendDias;
  if (patch.archiveDias !== undefined) body['archiveDays'] = patch.archiveDias;
  if (patch.prontoRenewalCentavos !== undefined) {
    body['prontoRenewalCents'] = patch.prontoRenewalCentavos;
  }
  if (patch.plaqueValueCentavos !== undefined) body['plaqueValueCents'] = patch.plaqueValueCentavos;
  if (patch.plaquePenaltyPct !== undefined) body['plaquePenaltyPct'] = patch.plaquePenaltyPct;
  if (patch.resellerGraceDays !== undefined) body['resellerGraceDays'] = patch.resellerGraceDays;
  return body;
}

export function mapPlan(row: Record<string, unknown>): Plan {
  return {
    id: String(row['id']),
    code: String(row['code']),
    nome: String(row['name'] ?? ''),
    tipo: row['type'] as Plan['tipo'],
    precoCentavos: Number(row['priceCents'] ?? 0),
    intervalo: (row['interval'] as string | null) ?? null,
    features: (row['features'] as Record<string, unknown>) ?? {},
  };
}

export function mapCoupon(row: Record<string, unknown>): Coupon {
  const validTo = row['validTo'] ? String(row['validTo']).slice(0, 10) : '';
  return {
    id: String(row['id']),
    code: String(row['code']),
    tipo: row['type'] as Coupon['tipo'],
    valor: Number(row['value'] ?? 0),
    validade: validTo,
    maxUsos: Number(row['maxUses'] ?? 0),
    usos: Number(row['usedCount'] ?? 0),
    planIds: [],
  };
}

export function mapReseller(row: Record<string, unknown>): Reseller {
  const users = row['users'] as { id: string }[] | undefined;
  return {
    id: String(row['id']),
    userId: users?.[0]?.id ?? '',
    nome: String(row['name'] ?? ''),
    resellerPlanId: String(row['resellerPlanId'] ?? ''),
    status: row['status'] as Reseller['status'],
    delinquentSince: (row['delinquentSince'] as string | null) ?? null,
    blockedAt: (row['blockedAt'] as string | null) ?? null,
    blockReason: (row['blockedReason'] as string | null) ?? null,
    asaasWalletId: null,
  };
}

export function mapResellerPlan(row: Record<string, unknown>): ResellerPlan {
  return {
    id: String(row['id']),
    nome: String(row['name'] ?? ''),
    mensalidadeCentavos: Number(row['monthlyFeeCents'] ?? 0),
    custoPorSiteAtivoCentavos: 0,
    limiteSites: (row['siteLimit'] as number | null) ?? null,
  };
}

export function mapAuditLog(row: Record<string, unknown>): AuditLog {
  return {
    actor: String(row['actorId'] ?? ''),
    acao: String(row['action'] ?? ''),
    entidade: `${row['entity'] ?? ''}:${row['entityId'] ?? ''}`,
    diff: (row['diff'] as Record<string, unknown>) ?? {},
  };
}

export function unsupported(method: string): never {
  throw new Error(`UNSUPPORTED_API:${method}`);
}
