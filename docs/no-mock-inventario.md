# Inventário NO-MOCK — Seja Engajado

Gerado em 2026-10-16. Prefixo HTTP Nest: `/api`.

## Seleção Mock vs HTTP

| Ambiente | Provider |
| --- | --- |
| `production` build | `fileReplacements` troca `api.providers.ts` → `api.providers.http.ts` (só `HttpApiService`) |
| `development` / testes | `api.providers.ts` escolhe por `environment.apiUrl`; specs usam `MockApiService` |

**Garantia:** `MockApiService` nunca entra no bundle de produção (replacement + teste).

## Resumo ApiPort (73 métodos)

| Status HttpApi | Qtd |
| --- | ---: |
| Real (HTTP) | ~58 |
| Stub (`of([])` / `of(null)` / `of(true)`) | 4 |
| `unsupported` | 11 |

## Gaps de produção (P0)

| método | Nest | Ação |
| --- | --- | --- |
| `listTemplates` | `GET /customer/templates`, `site-options` | Reaproveitar → `GET /admin/templates` + ligar |
| `deleteCoupon` | só create | Criar `DELETE /admin/coupons/:id` (soft: `active=false`) |
| `quotePlaquePenalty` / `cancelSite` | `penalty.ts`, `DirectBillingService.chargeCancellationPenalty` | Criar rotas CUSTOMER |
| `setSiteStatus` | publish/unpublish; suspend bulk | Criar `PATCH /admin/sites/:id/status` |
| `closeResellerInvoice` | `ResellerInvoiceJob` | Criar `POST /admin/resellers/:id/invoices/close` |
| `listMyInvoices` (admin UI) | `GET /reseller/invoices` | Criar `GET /admin/invoices` + fallback HttpApi |
| `requestSiteChange` / `requestMonthlyPlan` | audit | Criar POSTs CUSTOMER → AuditLog |
| `requestCustomerOtp` / `verifyCustomerOtp` | GoTrue no web | Ligar via `AuthService` (sem Nest) |
| `getOrder` / `recordNotice` / `canCreateSite` | — | Fora de escopo UI prod (stubs seguros) |

## featureFlags

| Flag | Alvo pós NO-MOCK |
| --- | --- |
| `adminCustomers/Sites/Revenue/Dashboard` | `true` |
| `adminFaturas` | `true` (GET /admin/invoices) |
| `adminCouponDelete` | `true` |
| `customerPlaqueCancel` | `true` |

## Já ligados (amostra)

Admin: config, plans, coupons list/create, resellers, customers, sites, payments, products, plaques, wholesale, audit.  
Revenda: dashboard, customers(+invite), sites, sales, ledger, wholesale, invoices.  
Cliente: sites, templates, publish, uploads.  
Público: by-host, avaliar.

## Testes de isolamento

- `api/test/int/reseller-sites.int-spec.ts` — A↔B sites  
- `api/test/int/reseller-happy-path.int-spec.ts` — fluxo go-live  
- `api/test/int/rls.int-spec.ts` — RLS
