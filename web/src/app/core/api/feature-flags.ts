import { environment } from '../../../environments/environment';

/** `true` quando o painel fala com a Nest API (produção / apiUrl setado). */
export const usesHttpApi = Boolean(environment.apiUrl?.trim());

/**
 * Superfície de UI ligada ao backend real. Em produção (`usesHttpApi`) todas
 * ficam `true` — inventário em docs/no-mock-inventario.md. MockApi só em
 * development/testes e nunca no bundle de produção (fileReplacements).
 */
export const featureFlags = {
  adminCustomers: true,
  adminSites: true,
  adminRevenue: true,
  adminDashboard: true,
  adminFaturas: true,
  adminCouponDelete: true,
  customerPlaqueCancel: true,
} as const;
