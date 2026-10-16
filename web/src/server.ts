import { APP_BASE_HREF } from '@angular/common';
import { RESPONSE_INIT } from '@angular/core';
import { CommonEngine, isMainModule } from '@angular/ssr/node';
import * as Sentry from '@sentry/node';
import express from 'express';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveHost } from './app/core/tenant/resolve-host';
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

/**
 * Handle all other requests by rendering the Angular application.
 */
app.get('**', (req, res, next) => {
  const { protocol, originalUrl, baseUrl, headers } = req;
  const responseInit: ResponseInit = { status: 200 };
  const host = headers.host ?? '';
  const search = originalUrl.includes('?') ? originalUrl.slice(originalUrl.indexOf('?')) : '';
  const decision = resolveHost(host, search);

  commonEngine
    .render({
      bootstrap,
      documentFilePath: indexHtml,
      url: `${protocol}://${host}${originalUrl}`,
      publicPath: decision.kind === 'landing' ? browserDistFolder : undefined,
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
