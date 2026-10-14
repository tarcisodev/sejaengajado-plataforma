import { APP_BASE_HREF } from '@angular/common';
import { RESPONSE_INIT } from '@angular/core';
import { CommonEngine, isMainModule } from '@angular/ssr/node';
import express from 'express';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveHost } from './app/core/tenant/resolve-host';
import bootstrap from './main.server';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');
const indexHtml = join(serverDistFolder, 'index.server.html');

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

/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/**', (req, res) => {
 *   // Handle API request
 * });
 * ```
 */

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
    .catch((err) => next(err));
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
