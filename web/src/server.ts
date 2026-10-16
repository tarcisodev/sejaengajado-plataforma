import { APP_BASE_HREF } from '@angular/common';
import { RESPONSE_INIT } from '@angular/core';
import { CommonEngine, isMainModule } from '@angular/ssr/node';
import * as Sentry from '@sentry/node';
import express from 'express';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveHost } from './app/core/tenant/resolve-host';
import {
  apiInternalBase,
  businessNameFromBody,
  fetchPublicSiteByHost,
} from './app/core/ssr/fetch-public-site';
import { scrubSentryEvent } from './app/core/sentry/scrub';
import bootstrap from './main.server';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');
const indexHtml = join(serverDistFolder, 'index.server.html');

function readSecretFile(path: string | undefined): string {
  if (!path) {
    return '';
  }
  try {
    return readFileSync(path, 'utf8').trim();
  } catch {
    return '';
  }
}

const sentryDsn =
  readSecretFile(process.env['SENTRY_DSN_FILE']) || (process.env['SENTRY_DSN'] ?? '').trim();
const sentryRelease = (process.env['SENTRY_RELEASE'] || process.env['IMAGE_TAG'] || '').trim();
const supabaseUrl = (process.env['SUPABASE_URL'] ?? '').trim();
const supabaseAnonKey = (process.env['SUPABASE_ANON_KEY'] ?? '').trim();
const apiPublicUrl = (process.env['API_PUBLIC_URL'] ?? '/api').trim() || '/api';
const isDev = process.env['NODE_ENV'] !== 'production';

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    release: sentryRelease || undefined,
    environment: process.env['NODE_ENV'] || 'production',
    beforeSend: (event) => scrubSentryEvent(event),
    ...({ sendDefaultPii: false } as object),
  });
}

const app = express();
const commonEngine = new CommonEngine({
  allowedHosts: [
    'localhost',
    '127.0.0.1',
    '*.localhost',
    'sejaengajado.com.br',
    '*.sejaengajado.com.br',
  ],
});

/** Liveness only — must not depend on the API (no cascade). */
app.get('/healthz', (_req, res) => {
  res.status(200).type('text/plain').send('ok');
});

/**
 * Public runtime config for the browser (no service_role / no private keys).
 * Sentry DSN comes from SENTRY_DSN_FILE; Supabase anon from container env at deploy.
 */
app.get('/se-public-config.json', (_req, res) => {
  res
    .status(200)
    .type('application/json')
    .set('Cache-Control', 'no-store')
    .send(
      JSON.stringify({
        sentryDsn: sentryDsn || null,
        sentryRelease: sentryRelease || null,
        supabaseUrl: supabaseUrl || null,
        supabaseAnonKey: supabaseAnonKey || null,
        apiUrl: apiPublicUrl,
      }),
    );
});

/** Dev-only: proxy /api → local Nest (production Traefik routes /api). */
if (isDev) {
  app.use('/api', async (req, res) => {
    const target = `${apiInternalBase()}${req.originalUrl}`;
    try {
      const upstream = await fetch(target, {
        method: req.method,
        headers: { accept: req.headers.accept ?? 'application/json' },
      });
      res.status(upstream.status);
      const type = upstream.headers.get('content-type');
      if (type) {
        res.type(type);
      }
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.send(buf);
    } catch {
      res.status(502).json({ code: 'BAD_GATEWAY', message: 'API indisponível' });
    }
  });
}

/**
 * Serve hashed assets only. `index: false` keeps `/` and `?tenant=` on the SSR handler,
 * so a prerendered landing is not returned for a tenant host.
 */
app.get(
  '**',
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
  }),
);

function noticeHtml(title: string, body: string): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title></head><body><main><h1>${title}</h1><p>${body}</p></main></body></html>`;
}

/**
 * Handle all other requests by rendering the Angular application.
 */
app.get('**', async (req, res, next) => {
  const { protocol, originalUrl, baseUrl, headers } = req;
  const responseInit: ResponseInit = { status: 200 };
  const host = headers.host ?? '';
  const search = originalUrl.includes('?') ? originalUrl.slice(originalUrl.indexOf('?')) : '';
  const decision = resolveHost(host, search);

  if (decision.kind === 'tenant') {
    const pathOnly = originalUrl.split('?')[0] ?? '/';
    if (pathOnly === '/avaliar' || pathOnly === '/avaliar/') {
      const target = `${apiInternalBase()}/api/public/r/${encodeURIComponent(decision.slug)}/avaliar`;
      res.redirect(302, target);
      return;
    }

    const fetchHost =
      host.includes('localhost') && decision.slug
        ? `${decision.slug}.sejaengajado.com.br`
        : (host.split(':')[0] ?? host);
    try {
      const result = await fetchPublicSiteByHost(fetchHost);
      if (result.kind === 'not-found') {
        res
          .status(404)
          .type('html')
          .send(
            noticeHtml('Negócio não encontrado', `O endereço ${decision.slug} não está publicado.`),
          );
        return;
      }
      if (result.kind === 'archived') {
        res
          .status(410)
          .type('html')
          .send(noticeHtml('Indisponível', 'Este site não está mais neste endereço.'));
        return;
      }
      if (result.kind === 'suspended') {
        const name = businessNameFromBody(result.body);
        res
          .status(503)
          .set('Retry-After', '3600')
          .type('html')
          .send(
            noticeHtml('Temporariamente indisponível', `${name} está fora do ar por um momento.`),
          );
        return;
      }
      if (result.kind === 'error') {
        res
          .status(502)
          .type('html')
          .send(noticeHtml('Indisponível', 'Tente novamente em instantes.'));
        return;
      }
    } catch (err) {
      Sentry.captureException(err);
    }
  }

  // Beasties off: evitava path /server/*.css e picos de heap no container.
  // publicPath só no apex (SSG); em tenant `/` colidiria com index da landing.
  commonEngine
    .render({
      bootstrap,
      documentFilePath: indexHtml,
      url: `${protocol}://${host}${originalUrl}`,
      publicPath: decision.kind === 'landing' ? browserDistFolder : undefined,
      inlineCriticalCss: false,
      providers: [
        { provide: APP_BASE_HREF, useValue: baseUrl },
        { provide: RESPONSE_INIT, useValue: responseInit },
      ],
    })
    .then((html) => res.status(responseInit.status ?? 200).send(html))
    .catch((err) => {
      Sentry.captureException(err);
      next(err);
    });
});

/**
 * Start the server if this module is the main entry point.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

export default app;
