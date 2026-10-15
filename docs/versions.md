# Versões do monorepo

Fonte: `web/package.json` em 15/10/2026. API, Prisma e Postgres ainda não estão instalados; os números abaixo são a linha de base do bloco B1.

| Peça | Versão |
|---|---|
| Angular | 22.2 (`@angular/core` ^22.2.2, SSR `@angular/ssr` ^22.2.2) |
| TypeScript | ~6.0.3 |
| Tailwind CSS | 4.3 (`tailwindcss` ^4.3.3, `@tailwindcss/postcss`) |
| spartan | 1.6.3 (`@spartan-ng/brain` e helm, só no painel `app.`) |
| NestJS | 11 |
| Prisma | 6 |
| Postgres | 16 (produção: database `sejaengajado` no Supabase self-hosted; testes: Testcontainers) |
| Auth | Supabase Auth (OTP por e-mail); API valida JWT (JWKS ou secret) |
| Node da API | 22 (`.nvmrc`) |

Qualquer menção a Angular 19, Tailwind 3.4 ou TypeORM em documento antigo está errada. O ORM é Prisma.
