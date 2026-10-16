# Matriz CRUD — diagnóstico FLUXO-FELIZ

Legenda: **ok** = existe e funciona · **parcial** = existe com lacuna · **não** = não existe.  
Atualizado no início do M1 (issue #8). Links de teste serão preenchidos quando os specs verdes existirem.

| Entidade | ADMIN | RESELLER | CUSTOMER | Evidência / lacuna |
|---|---|---|---|---|
| Revendedores | parcial (CRUD+bloquear+convidar; impersonar M4) | parcial (perfil) | — | `admin-resellers`; invite existe |
| Planos de revendedor | ok | parcial (R) | — | `admin/reseller-plans` |
| Planos de cliente | ok | parcial (R) | parcial (R; troca M4) | `admin/plans` |
| Produtos/atacado | parcial | parcial (R; U preço venda M4) | — | `admin/wholesale` |
| Clientes | ok | ok | parcial (R/U) | admin/reseller/customer |
| Sites | parcial→ok (C/R/U/content/P/archive + `site-editor`) | ok (C/R/U/P + editor; archive soft) | parcial (studio Pro; Pronto CTA) | e2e admin-site/revenda stubs; happy path precisa stack local |
| Templates | parcial (R ativo; CRUD completo?) | R | R (editor) | `GET admin/templates` |
| Cupons | ok | parcial (aplicar venda) | parcial (checkout M4) | admin coupons |
| Placas | parcial | parcial | parcial | admin/reseller stock |
| Vendas/pedidos | parcial | parcial (C em M2) | R | M2 |
| Cobranças/faturas | parcial | parcial | parcial | M3 sandbox |
| Config plataforma | ok | — | — | `admin/config` |

## Bugs M0/M1

| Id | Status | Nota |
|---|---|---|
| 0.a | feito em `579ee61` | Nest no-store + SSR_PUBLIC_SITE |
| 0.b | feito em `579ee61` | site-page sem listTemplates auth |
| 0.c | mitigado no código | `registerEsmLoaderHooks: false` em `web/src/server.ts` — validar em deploy |
| 0.d | observar pós-M0 | carga SSR reduzida (sem templates auth); confirmar ausência de exit 139 no deploy |
| 0.e | UI+API na branch | admin/revenda: create→`site-editor` + Publicar; e2e precisa TOTP+Mailpit |
