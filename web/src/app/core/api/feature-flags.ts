import { environment } from '../../../environments/environment';

/** `true` quando o painel fala com a Nest API (produção / apiUrl setado). */
export const usesHttpApi = Boolean(environment.apiUrl?.trim());

/**
 * Telas sem endpoint real ficam só no mock.
 * Em produção (HttpApi) não há fallback para mock.
 */
export const featureFlags = {
  /** Admin: lista global de clientes — sem GET /admin/customers. */
  adminCustomers: !usesHttpApi,
  /** Admin: lista global de sites — sem GET /admin/sites. */
  adminSites: !usesHttpApi,
  /** Admin: receita via payments — sem GET /admin/payments. */
  adminRevenue: !usesHttpApi,
  /** Admin: dashboard agregado de payments — sem endpoint dedicado. */
  adminDashboard: !usesHttpApi,
  /** Admin: "Minhas faturas" é de revendedor. */
  adminFaturas: !usesHttpApi,
  /** Admin: delete de cupom — API só cria. */
  adminCouponDelete: !usesHttpApi,
  /** Cliente: multa/cancelamento de placa — sem endpoint no Nest ainda. */
  customerPlaqueCancel: !usesHttpApi,
} as const;
