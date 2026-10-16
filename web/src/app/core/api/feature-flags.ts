import { environment } from '../../../environments/environment';

/** `true` quando o painel fala com a Nest API (produção / apiUrl setado). */
export const usesHttpApi = Boolean(environment.apiUrl?.trim());

/**
 * Telas sem endpoint real ficam só no mock.
 * Em produção (HttpApi) não há fallback para mock.
 */
export const featureFlags = {
  /** Admin: lista global de clientes — GET /admin/customers. */
  adminCustomers: true,
  /** Admin: lista global de sites — GET /admin/sites. */
  adminSites: true,
  /** Admin: receita via payments — GET /admin/payments. */
  adminRevenue: true,
  /** Admin: dashboard agregado de payments — usa listPayments + listSites. */
  adminDashboard: true,
  /** Admin: "Minhas faturas" é de revendedor. */
  adminFaturas: !usesHttpApi,
  /** Admin: delete de cupom — API só cria. */
  adminCouponDelete: !usesHttpApi,
  /** Cliente: multa/cancelamento de placa — sem endpoint no Nest ainda. */
  customerPlaqueCancel: !usesHttpApi,
} as const;
