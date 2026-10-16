# Seja Engajado: revisão de segurança e anti-abuso pré-produção

Escopo: só leitura do repositório em `E:\dev\sejaengajado\plataforma` (HEAD 9e7fe12) e dos documentos em `producao/` e `infra/`. Não acessei nenhum servidor. As referências `arquivo:linha` são do que li de fato. Os arquivos de GoTrue/Supabase/Traefik de produção **não estão no repo**, então, nesses pontos, o que vai abaixo é recomendação de configuração, não achado verificado.

Estado do código: só existem auth, tenant/RLS, auditoria, admin de revendedores e places (este último nem está registrado no AppModule). Ainda não existem webhook, uploads, by-host público, login no web (o web usa mocks) nem gateway real (`FakeGateway`).

---

## 1) CRÍTICO, bloqueia a produção

### C1. Senhas fixas das roles do Postgres dentro das migrations (no Postgres compartilhado do Supabase)
- **Problema:** as migrations criam `se_app` com a senha `'se_app'` e `se_admin` (BYPASSRLS) com a senha `'se_admin'`. Elas rodam no Postgres do Supabase, que é compartilhado com o SaaS de QR. Quem alcançar o Postgres ou o pooler (Supavisor) e tentar `se_admin/se_admin` lê todo o banco, sem RLS.
- **Evidência:** `api/prisma/migrations/20261015193000_production_schema/migration.sql:683`; `api/prisma/migrations/20261015200000_row_level_security/migration.sql:6`.
- **Onde corrigir:** Supabase/Postgres (rotacionar) e migrations (não criar role com senha).
- **Cursor:**
```text
Nas migrations api/prisma/migrations/*: remova o PASSWORD literal de CREATE ROLE se_app/se_admin. Crie as roles com NOLOGIN se ainda não existirem e documente em infra/secrets.md que a senha é definida fora do repo com
`ALTER ROLE se_app LOGIN PASSWORD :'pw'` (psql -v pw=... a partir de Docker secret). Não edite migrations já aplicadas em produção. Crie uma migration nova que faça
`ALTER ROLE se_app NOLOGIN; ALTER ROLE se_admin NOLOGIN;`, a ser seguida pelo runbook de definir a senha. Adicione ao CI um teste que falhe se aparecer "PASSWORD '" em qualquer migration.
```
Runbook manual (Tarciso): `ALTER ROLE se_app PASSWORD '<forte>'; ALTER ROLE se_admin PASSWORD '<forte>';` e atualizar `se_database_url_v1` e o admin URL.

### C2. `TRUNCATE` concedido ao `se_app`: ignora o RLS e o append-only
- **Problema:** o `se_app` tem `TRUNCATE` em todas as tabelas, inclusive nas futuras (default privileges). `TRUNCATE` não passa por policy de RLS nem pelos triggers `BEFORE UPDATE OR DELETE`. Uma injeção ou um bug zera `ledger_entries` e `audit_logs` de todos os tenants. O `REVOKE` da linha 693 não inclui `TRUNCATE`.
- **Evidência:** `20261015193000_production_schema/migration.sql:689, 693, 695-696, 650-664`.
- **Onde corrigir:** migration nova (Supabase Postgres).
- **Cursor:**
```text
Crie a migration api/prisma/migrations/<ts>_harden_grants/migration.sql:
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM se_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRUNCATE ON TABLES FROM se_app;
REVOKE UPDATE, DELETE, TRUNCATE ON ledger_entries, plaque_movements, audit_logs, lifecycle_events FROM se_app, se_admin;
CREATE TRIGGER audit_logs_no_truncate BEFORE TRUNCATE ON audit_logs FOR EACH STATEMENT EXECUTE FUNCTION prevent_append_only_mutation();
(repita o trigger de TRUNCATE para ledger_entries, plaque_movements e lifecycle_events)
Adicione um teste de integração (Testcontainers) provando que TRUNCATE como se_app falha.
```

### C3. JWT com validade de 1 ano e secret HS256 compartilhado com o SaaS de QR
- **Problema:** `GOTRUE_JWT_EXP=31536000`. O guard confere `iss`/`aud`/`exp`, mas `iss` e `aud` são os mesmos do QR SaaS, e o guard não consulta revogação de sessão. Um access token vazado (por exemplo, por XSS ou log no QR SaaS) vale 1 ano aqui para qualquer usuário convidado, inclusive ADMIN se o token tiver `aal2`. O único freio é o `status` no DB.
- **Evidência:** `api/src/auth/supabase-jwt.guard.ts:55-59` (só `iss`/`aud`/`alg`), `:74-88`; `producao/PRODUCAO-00-indice.md:73`; `PRODUCAO-06-infra-golive.md:65` (pendente).
- **Onde corrigir:** GoTrue env (obrigatório) e Nest (defesa extra).
- **GoTrue env:**
```env
GOTRUE_JWT_EXP=3600
GOTRUE_SECURITY_REFRESH_TOKEN_ROTATION_ENABLED=true
GOTRUE_SECURITY_REFRESH_TOKEN_REUSE_INTERVAL=10
```
- **Cursor (Nest):**
```text
Em api/src/auth/supabase-jwt.guard.ts, depois do jwtVerify: rejeite (401 UNAUTHORIZED) o token se payload.exp - payload.iat > Number(env.SUPABASE_JWT_MAX_TTL ?? 3600), para que, mesmo com GOTRUE_JWT_EXP alto, a API só aceite tokens curtos. Passe também `clockTolerance: 30` e `requiredClaims: ['exp','iat','sub']` ao jwtVerify.
Para rotas ADMIN (RolesGuard), exija que payload.iat seja de no máximo 12h atrás.
Adicione SUPABASE_JWT_MAX_TTL (default 3600) a src/config/env.ts e .env.example, e escreva testes: token com ttl de 1 ano → 401; token de admin velho → 403 AUTH_MFA_REQUIRED/REAUTH.
```
- Longo prazo: uma instância GoTrue própria (ou JWT secret próprio) para o Seja Engajado.

### C4. Abuso de OTP/e-mail no GoTrue compartilhado (sem captcha; autoconfirm ligado)
- **Problema:** `GOTRUE_MAILER_AUTOCONFIRM=true` está ligado, e o signup precisa ficar aberto por causa do QR SaaS. Qualquer pessoa chama `/auth/v1/otp` ou `/signup` direto no GoTrue (fora do Nest e fora do router do Traefik do Seja Engajado). Isso queima a cota do Resend e a reputação de `no-reply@sejaengajado.com.br`, e permite brute force do código OTP. Não há Turnstile no web: o login real ainda nem existe, porque `web/src` usa mocks. Os limites `GOTRUE_RATE_LIMIT_*` e o captcha não estão no repo, então não verifiquei.
- **Evidência:** `producao/PRODUCAO-00-indice.md:73` (autoconfirm e instância compartilhada), `:75` (SMTP Resend); nenhuma ocorrência de `turnstile`/`captcha`/`signInWithOtp` em `web/src`.
- **Onde corrigir:** GoTrue env, Cloudflare Turnstile e web. Atenção: o captcha do GoTrue vale para a instância inteira, então o QR SaaS também precisa mandar `captchaToken`.
- **GoTrue env:**
```env
GOTRUE_RATE_LIMIT_EMAIL_SENT=30          # e-mails/hora na instância inteira (ajustar ao plano Resend)
GOTRUE_RATE_LIMIT_OTP=30                 # pedidos de OTP / 5 min por IP
GOTRUE_RATE_LIMIT_VERIFY=30              # verificações / 5 min por IP (brute force do código)
GOTRUE_RATE_LIMIT_TOKEN_REFRESH=150
GOTRUE_RATE_LIMIT_HEADER=X-Real-IP       # só se o proxy à frente do GoTrue (Kong/Traefik) sobrescrever esse header; nunca confiar no header do cliente
GOTRUE_SMTP_MAX_FREQUENCY=60s            # 1 e-mail por endereço por minuto
GOTRUE_MAILER_OTP_EXP=600                # 10 min
GOTRUE_MAILER_OTP_LENGTH=8
GOTRUE_SECURITY_CAPTCHA_ENABLED=true
GOTRUE_SECURITY_CAPTCHA_PROVIDER=turnstile
GOTRUE_SECURITY_CAPTCHA_SECRET=<turnstile secret via secret>
GOTRUE_SECURITY_CAPTCHA_TIMEOUT=10s
```
- **Cursor (web, quando fizer o login 04-B1):**
```text
Na tela de login do painel (Angular), carregue o widget Cloudflare Turnstile (sitekey de env pública) e passe o token em
supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false, captchaToken } }) e em verifyOtp({ email, token, type: 'email', options: { captchaToken } }).
shouldCreateUser:false é obrigatório: só convidados entram. Bloqueie o botão "reenviar" por 60s no cliente e mostre uma mensagem genérica, que não revele se o e-mail existe.
```
- No Traefik: se o GoTrue sair por um router do Traefik, aplique um `ratelimit` próprio nos paths `/auth/v1/otp|/auth/v1/verify|/auth/v1/signup|/auth/v1/recover` (bloco no item A3). Como o Cloudflare está em DNS-only, **nenhuma regra de WAF ou rate limit do Cloudflare se aplica**.

### C5. Throttler do Nest atrás do Traefik sem `trust proxy`: um balde só para todo mundo
- **Problema:** o `ThrottlerGuard` global (120/min) usa `req.ip`. Sem `trust proxy`, `req.ip` é o IP do Traefik, então todos os usuários dividem os mesmos 120 req/min e um único cliente derruba a API para todos (DoS barato). Se alguém ligar `trust proxy=true` sem limite, o IP vira spoofável. Além disso, um 429 sai como `{code:'INTERNAL_ERROR'}`.
- **Evidência:** `api/src/main.ts:15-20` (sem `set('trust proxy')`), `api/src/app.module.ts:30,43`, `api/src/common/api-exception.filter.ts:23-29`.
- **Onde corrigir:** Nest.
- **Cursor:**
```text
api/src/main.ts: crie o app como NestFactory.create<NestExpressApplication>(...) e chame app.set('trust proxy', 1) (só o Traefik, 1 hop; Cloudflare em DNS-only). Também app.use(json({ limit: '100kb' })) e urlencoded({ limit: '100kb', extended: false }), e app.disable('x-powered-by').
api/src/app.module.ts: ThrottlerModule.forRoot com throttlers nomeados [{name:'short', ttl:1000, limit:10},{name:'default', ttl:60000, limit:120}] e getTracker por usuário quando autenticado (req.user?.id ?? req.ip). Como o guard de JWT roda depois, implemente um ThrottlerGuard customizado que use o sub do Bearer (decodificado sem verificar, só como chave) ou o IP.
api/src/common/api-exception.filter.ts: adicione 429 → { code: 'RATE_LIMITED', message: 'Muitas tentativas. Tente de novo em instantes.' }.
Teste: 2 IPs diferentes via X-Forwarded-For não compartilham o limite; header forjado com 2 hops não muda o IP considerado.
```

---

## 2) ALTO

### A1. `admin/auth/reset-link` devolve o link de recuperação ao admin (takeover entre produtos)
- **Problema:** o endpoint devolve `actionLink` no JSON. Como a base de usuários é compartilhada, um admin do Seja Engajado (ou um token de admin roubado) consegue logar como qualquer e-mail, inclusive contas do QR SaaS que nem são do Seja Engajado (não há checagem de que o e-mail é um `User` local). Ainda por cima, a resposta pode cair nos logs.
- **Evidência:** `api/src/auth/auth.controller.ts:101-115`; `http-supabase-admin.ts:32-49`. A rota não tem `@Audit` (só o audit genérico do interceptor, cujo diff grava `result`, ou seja, o próprio link, em `audit_logs`: `audit.interceptor.ts:87-90`).
- **Cursor:**
```text
Em api/src/auth/auth.controller.ts resetLink: (1) só aceite e-mail que exista em User (adminPrisma.user.findUnique por email) → 404 se não existir; (2) não devolva actionLink: dispare o e-mail pelo GoTrue (POST /auth/v1/recover ou generate_link + envio pelo SMTP do servidor) e retorne { sent: true }; (3) @Audit({action:'user.reset_link', entity:'User'}); (4) em audit.service.ts, adicione 'actionlink','action_link','link' a SECRET_KEYS.
```

### A2. Papel CUSTOMER herda o tenant inteiro do revendedor
- **Problema:** o `TenantScopeGuard` põe `resellerId` no ALS para CUSTOMER, e as policies de RLS filtram só por `reseller_id`. Quando as rotas do painel do cliente existirem, um CUSTOMER verá clientes, vendas, ledger e sites de todos os clientes do mesmo revendedor (IDOR horizontal). Hoje nenhuma rota CUSTOMER acessa dados, mas é um defeito de design no RLS e na extensão.
- **Evidência:** `api/src/tenant/tenant-scope.guard.ts:31-40`; `api/src/tenant/scoped-models.ts:5-23`; `row_level_security/migration.sql:56-61`; o convite permite `role: 'CUSTOMER'` (`auth.controller.ts:23`).
- **Cursor:**
```text
Adicione um segundo GUC app.customer_id: na extensão (prisma-tenant.extension.ts withResellerRls) faça também set_config('app.customer_id', <customerId do actor ou ''>, true). TenantActor ganha customerId (lido do DB, User→Customer).
Migration nova: para customers, sites, orders, payments, subscriptions, scan_events, crie uma policy RESTRICTIVE `customer_scope` TO se_app USING (NULLIF(current_setting('app.customer_id', true),'') IS NULL OR customer_id = current_setting('app.customer_id', true)::uuid), adaptando às colunas reais do schema.prisma.
Para CUSTOMER, negue por RLS (policy restrictive com customer_id setado → false) as tabelas sales, ledger_entries, wholesale_prices, reseller_prices, plaque_movements, reseller_invoices e invoice_lines.
Teste A↔B: dois customers do mesmo reseller não se veem.
```

### A3. Traefik: sem CSP, sem inflightreq, sem limite específico para auth; doc inconsistente sobre o host da API
- **Problema:** o modelo de labels tem HSTS, nosniff, frameDeny e referrer, mas não tem CSP, `permissionsPolicy`, `inFlightReq`, limite por path de auth nem `ipAllowList` para nada administrativo. O `contrib-atlas` ainda usa `api.sejaengajado.com.br`, enquanto a D17 decidiu `app./api` (mesma origem). O `stack.yml` ainda não existe no repo.
- **Evidência:** `producao/contrib-atlas.md:102-117, 217-221`; `PRODUCAO-00-indice.md:58`; `PRODUCAO-06-infra-golive.md:16`.
- **Cursor (infra/stack.yml, 06-B2):**
```yaml
- traefik.http.middlewares.se-headers.headers.stsSeconds=31536000
- traefik.http.middlewares.se-headers.headers.stsIncludeSubdomains=true
- traefik.http.middlewares.se-headers.headers.stsPreload=false
- traefik.http.middlewares.se-headers.headers.contentTypeNosniff=true
- traefik.http.middlewares.se-headers.headers.frameDeny=true
- traefik.http.middlewares.se-headers.headers.referrerPolicy=strict-origin-when-cross-origin
- traefik.http.middlewares.se-headers.headers.permissionsPolicy=camera=(), microphone=(), geolocation=()
- traefik.http.middlewares.se-headers.headers.customResponseHeaders.X-Powered-By=
- traefik.http.middlewares.se-csp-app.headers.contentSecurityPolicy=default-src 'self'; script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com https://www.google.com; connect-src 'self' https://<SUPABASE_HOST>; img-src 'self' data: https://img.sejaengajado.com.br; style-src 'self' 'unsafe-inline'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
- traefik.http.middlewares.se-ratelimit.ratelimit.average=20
- traefik.http.middlewares.se-ratelimit.ratelimit.burst=60
- traefik.http.middlewares.se-ratelimit.ratelimit.period=1s
- traefik.http.middlewares.se-inflight.inflightreq.amount=20
- traefik.http.routers.se-app.middlewares=se-headers,se-csp-app,se-inflight,se-ratelimit
- traefik.http.routers.se-web.middlewares=se-headers,se-inflight,se-ratelimit
# sem sourceCriterion: com DNS-only o remote addr é o cliente real. Se um dia ligar o proxy do CF, use sourceCriterion.ipStrategy.depth=1 + allowlist dos IPs do CF.
```
Remova as menções a `api.sejaengajado.com.br` do `contrib-atlas`, ou marque-as como obsoletas pela D17.

### A4. Postgres e pooler do Supabase: confirmar que não estão publicados
- **Problema:** o banco do Seja Engajado fica no Postgres do Supabase. O compose padrão do Supabase self-hosted publica 5432/6543 (Supavisor). O levantamento registrou `ufw inactive` e portas em todas as interfaces, e o Docker ignora o ufw. Por enquanto só o firewall do painel da Hostinger segura (22/80/443). Somado ao C1, uma exposição dessas é crítica. Não verifiquei o compose do Supabase.
- **Evidência:** `infra/runbooks/fase0/01-levantamento.md:86-87`; `04-hardening.md:62, 140-141`; checklist `PRODUCAO-06-infra-golive.md:60`.
- **Ação:** no compose do Supabase, retirar `ports:` de db/supavisor (ou fazer bind em `127.0.0.1`), mais uma regra `DOCKER-USER` de reserva. Validar com `nmap` de fora (manual, Tarciso).

### A5. IP do audit e request-id vêm de headers controlados pelo cliente
- **Problema:** o audit grava o primeiro valor do `X-Forwarded-For`, que é forjável. O `x-request-id` do cliente vira o `reqId` do log sem validação (injeção ou poluição de log).
- **Evidência:** `api/src/audit/audit.interceptor.ts:78-79`; `api/src/logging/redact.ts:31-34`.
- **Cursor:**
```text
audit.interceptor.ts: use apenas req.ip (com trust proxy=1, ver C5) e grave o hash (sha256 + pepper de env), conforme o contrato ipHash do contrib-nucleo.
redact.ts genReqId: aceite x-request-id só se casar /^[A-Za-z0-9-]{8,64}$/; caso contrário, randomUUID().
```

### A6. Audit e logs: PII e respostas inteiras no diff
- **Problema:** o diff do audit grava o `body` e o `result` completos. Isso inclui `email` (`SECRET_KEYS` não tem `email`), `users` aninhados de `get/create reseller` e o link de reset (A1). O redact do pino cobre `email` só em 1 nível (`*.email`) e não cobre `req.body.*` além de `webhook`.
- **Evidência:** `api/src/audit/audit.service.ts:6-20, 69-85`; `audit.interceptor.ts:87-90`; `api/src/logging/redact.ts:7-25`.
- **Cursor:**
```text
audit.service.ts: em SECRET_KEYS inclua 'email','whatsapp','cpf','cnpj','phone','telefone','actionlink','action_link'. Mascare e-mail (a***@dominio) em vez de removê-lo.
audit.interceptor.ts: em result, guarde só { id } e os campos alterados, nunca o objeto inteiro.
redact.ts: acrescente 'req.body.*.email','res.headers["set-cookie"]','*.*.email','*.access_token','*.refresh_token'.
```

---

## 3) MÉDIO, ou depois

- **M1. `FakeGateway` sempre registrado** (`api/src/app.module.ts:40-41`). Falhe a subida se `NODE_ENV=production` e o gateway for o fake. Webhook Asaas ainda não existe. Ao fazer o 05-B3, siga o próprio plano (`PRODUCAO-05-pagamentos.md:21`): `crypto.timingSafeEqual` sobre buffers de mesmo tamanho, 401 sem gravar, `@Public()` + `@Throttle` próprio + `@SkipThrottle` só se o Traefik limitar, body limit pequeno, sem audit do payload.
```text
Em app.module.ts: provider PAYMENT_GATEWAY com useFactory(env) que lança Error('FakeGateway proibido em produção') quando env.NODE_ENV==='production' e ASAAS_API_KEY está ausente.
```
- **M2. Validação manual por zod em cada handler, sem pipe global.** `resetLink` usa `.parse` direto (`auth.controller.ts:105`). Funciona (o filtro trata ZodError), mas `@Param('id')` não é validado como UUID em `resellers.controller.ts:55-166`: um id inválido gera erro do Prisma, que vira 500. Crie um `ParseUUIDPipe` em todos os `:id`, e `limit` com `Number.isInteger` em `resellers.controller.ts:27` (o service faz clamp, mas `NaN` passa).
- **M3. 429 e 409 sem mapeamento** em `api-exception.filter.ts:23-29`. Também não há log de erro 500: o filtro engole a exceção sem chamar o logger. Adicione `logger.error({err})` (sem body) para conseguir investigar.
- **M4. `SYSTEM_PRISMA` sem restrição** (se_admin, BYPASSRLS) é exportado globalmente (`prisma.module.ts:54-58, 76`). Qualquer service novo pode injetá-lo. Prefira uma função `SECURITY DEFINER` `auth_lookup_user(supabase_id)` com role própria, ou uma regra de lint ou teste que proíba `SYSTEM_PRISMA` fora de `supabase-jwt.guard.ts`.
- **M5. Default privileges `GRANT ALL ... TO se_admin`** (`row_level_security/migration.sql:12-16`) dão ao se_admin UPDATE/DELETE nas tabelas append-only. Os triggers seguram, mas revogue também (veja C2).
- **M6. Tabelas sem RLS acessíveis ao `se_app`:** resellers, reseller_plans, audit_logs e outras que não estão na lista (`row_level_security/migration.sql:36-51`). O `se_app` tem SELECT/INSERT/UPDATE nelas (`production_schema:689`). Habilite RLS com uma policy de leitura mínima, ou revogue do `se_app` o que for só de admin (audit_logs, reseller_plans write).
- **M7. Subdomínios wildcard:** o by-host público ainda não existe. Ao fazê-lo: resolver o tenant só pelo `Host` validado contra `^[a-z0-9-]+\.sejaengajado\.com\.br$`, nunca por `X-Forwarded-Host`. Lista de reservados (`app`, `api`, `admin`, `www`, `mail`, `auth`, `img`, `teste`, `send`, `rsend`). Cache negativo para não martelar o DB. Rate limit do by-host. Os sites de tenant não devem servir HTML ou JS arbitrário (risco de phishing sob o domínio, `contrib-alicerce.md:118`).
- **M8. `bypassSecurityTrustResourceUrl` no mapa** (`web/.../tenant-site/site-page.component.ts:115`): garanta que `mapsEmbedUrl` monte sempre `https://www.google.com/maps/embed?...` com `encodeURIComponent`, nunca a partir de uma URL fornecida pelo usuário.
- **M9. Uploads:** o plano é R2 por URL pré-assinada (`PRODUCAO-00-indice.md:90`). Ao implementar: chave gerada no servidor (`resellerId/uuid`), `Content-Type` e `Content-Length` fixos na assinatura, expiração de 5 min, allowlist de image/jpeg, png e webp, e sem SVG.
- **M10. SSRF:** só existe chamada a URL fixa (Google Places, `places-client.ts:21`; Supabase via env). Sem SSRF hoje. O `PlacesModule` não está importado no `AppModule` (`app.module.ts:27-35`), então a rota não existe.
- **M11. Repo e segredos:** `api/.env` e `web/.env` não estão versionados (gitignore confirmado). Só os `.env.example` estão no git. `docker-compose.dev.yml:8,11` tem senha de dev e publica 5432, aceitável só local. Rodar `gitleaks` no CI (o plano está em `PRODUCAO-01-fundacao.md:81`).
- **M12. Dependências:** `jsonwebtoken` está nas deps sem uso aparente no `src` (a validação é com `jose`). Remova para reduzir a superfície. Rodar `npm audit --audit-level=high` no CI.
- **M13. CORS:** não há `enableCors` (`main.ts`), o que está correto para a D17 (mesma origem). Não habilitar wildcard no futuro.
- **M14. Helmet** com defaults (`main.ts:18`). A CSP do helmet só afeta o JSON da API. A CSP útil é a do Traefik ou do SSR (A3).
