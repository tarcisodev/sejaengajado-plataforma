# Cursor — Fase 04: Infra (wildcard, Traefik, Swarm, backup)
> ⚠️ **A execução no VPS é feita pelo Atlas e requer OK explícito do Tarciso** em cada passo que toca DNS, VPS, certificados ou produção. O Cursor só **gera arquivos e documentação**. Nada é aplicado automaticamente.
## Regras gerais (valem para todos os blocos)
- Execute **um bloco por vez**. No fim de cada bloco: rode os testes, faça commits pequenos (Conventional Commits) e **PARE**, mostrando um resumo e o que testar. Só siga quando eu disser "continuar".
- **Nenhum segredo no código.** Use `.env.example` com placeholders e leia de env/Docker secrets. Mantenha `.env` no `.gitignore`.
- **Sem deploy automático** e sem rodar comandos contra produção.
- Textos da UI em pt-BR. Código e nomes em inglês.

## Bloco 1: DNS na Cloudflare (decidido)
Documentar em `infra/README.md` o checklist: criar zona `sejaengajado.com.br` na Cloudflare → importar/conferir registros existentes (e-mail/MX!) → trocar os nameservers no painel da Hostinger (registro continua lá) → aguardar propagação. Registros: `A @`, `A *` e `A app` → IP do VPS (proxy desligado/cinza no início para não interferir no ACME e no Traefik). Criar API token com **Zone:DNS:Edit + Zone:Read restrito à zona sejaengajado.com.br**, guardado como Docker secret `cf_dns_api_token`, nunca no repo.
**Pronto:** checklist para o Tarciso aprovar. Commit. **PARE.**

## Bloco 2: Traefik com dnsChallenge
Exemplo de config do certresolver `letsencryptresolver` com `dnsChallenge.provider=cloudflare`, env `CF_DNS_API_TOKEN_FILE=/run/secrets/cf_dns_api_token`, resolvers `1.1.1.1:53` e **caServer de staging** primeiro. Labels do serviço SSR: `Host(`sejaengajado.com.br`) || HostRegexp(`{sub:[a-z0-9-]+}.sejaengajado.com.br`)` (sintaxe v2 ou v3 conforme a versão instalada), `tls.domains[0].main=sejaengajado.com.br`, `sans=*.sejaengajado.com.br`, entrypoint `websecure`. Middlewares: rate limit, security headers e redirect para HTTPS.
**Pronto:** `docker stack config` válido e plano de teste no staging. Commit. **PARE.**

## Bloco 3: Stack Swarm
`stack.yml`: api, web-ssr, postgres (volume) ou DB externo, redis opcional, worker de jobs (atraso/renovação/fechamento). O worker usa o calendário `America/Sao_Paulo` para `diasAtraso`, `NoticeLog.localDate` e a foto do fechamento. Rede overlay com o Traefik, healthchecks, `update_config` com rollback, secrets e limites de recursos. Migrations do Prisma como um job manual (`prisma migrate deploy`).
**Pronto:** validação local (`docker stack deploy` num Swarm de teste local), não no VPS. Commit. **PARE.**

## Bloco 4: Provisionamento automático do subdomínio
Documentar e testar que criar um Site **não** exige DNS nem certificado novo (o wildcard cobre). O "provisionamento" = registro no banco + invalidação do cache. Página "temporariamente indisponível" servida pelo SSR quando o by-host retorna SUSPENDED.
**Pronto:** teste e2e local com `*.localhost`. Commit. **PARE.**

## Bloco 5: Backup e observabilidade
`pg_dump` diário (cron/serviço), criptografado, com cópia offsite (S3-compatível), retenção de 7 diários e 4 semanais, e **script de restore testado**. Backup dos uploads. Logs centralizados, uptime check e alerta de expiração de certificado.
**Pronto:** restore testado localmente e runbook escrito. Commit. **PARE.**

## Bloco 6: Runbook de go-live (para o Atlas)
Passo a passo com pontos de "aguardar OK do Tarciso": DNS → staging do certificado → produção do certificado → deploy → smoke test (`teste.sejaengajado.com.br`) → rollback.
**Pronto:** runbook revisado. Commit. **PARE.**

## Bloco 7 (fase 2 — documentar só): Domínio próprio como add-on pago
**Não implementar no MVP.** Documento em `infra/custom-domains.md`: domínio próprio é add-on pago na fase 2; SSL via **Cloudflare for SaaS / custom hostnames** (evita emitir um cert LE por cliente no Traefik e o rate limit de 50/semana). Fluxo: cliente aponta CNAME → API cria custom hostname na Cloudflare → verificação → `Site.customDomain` ativo. Manter a interface/`customDomain` no schema desde o MVP, sem o provisionamento.

## Bloco 8 (fase 3 — documentar só): White label do revendedor
**Não implementar no MVP.** Após ~5 revendedores ativos, plano superior de white label (marca e domínio próprios do revendedor). Depende do add-on de domínio (fase 2). Só checklist/escopo em `infra/white-label.md`.
