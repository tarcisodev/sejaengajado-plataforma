import { environment } from '../../../environments/environment';

/** `true` quando o painel fala com a Nest API (produção / apiUrl setado). */
export const usesHttpApi = Boolean(environment.apiUrl?.trim());

/**
 * Flags de superfície de UI. Em produção (HttpApi) todas as telas com backend
 * real ficam habilitadas — ver docs/no-mock-inventario.md.
 */
export const featureFlags = {
  adminCustomers: true,
  adminSites: true,
  adminRevenue: true,
  adminDashboard: true,
  /** Admin: lista global de faturas (GET /admin/invoices). */
  adminFaturas: true,
  /** Admin: DELETE /admin/coupons/:id (soft deactivate). */
  adminCouponDelete: true,
  /** Cliente: GET/POST cancelamento + multa de placa. */
  customerPlaqueCancel: true,
} as const;
