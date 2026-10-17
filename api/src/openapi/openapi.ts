import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import type { Env } from '../config/env';

/** Docs never mount in production; elsewhere only when ENABLE_DOCS=true. */
export function shouldEnableDocs(env: Pick<Env, 'ENABLE_DOCS' | 'NODE_ENV'>): boolean {
  if (env.NODE_ENV === 'production') {
    return false;
  }
  return env.ENABLE_DOCS === true;
}

/**
 * OpenAPI 3 document for the /api surface — error shape, pagination and
 * Idempotency-Key notes for HttpApiService codegen on the web app.
 */
export function setupOpenApi(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Seja Engajado API')
    .setDescription(
      [
        'API sob `/api` na mesma origem (sem CORS).',
        'Erros: `{ code, message, fields? }` com `message` em pt-BR.',
        'Validação: `code=VALIDATION_FAILED` e `fields:[{path,code,message}]`.',
        'Paginação: `{ items, nextCursor }` (cursor base64url de `createdAt,id`, limite ≤ 100).',
        'Escritas críticas (venda, estorno, estoque): header `Idempotency-Key`.',
        'Rotas ADMIN exigem JWT Supabase (MFA/TOTP opcional; `aal2` quando enrolado).',
      ].join('\n\n'),
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Supabase access token' },
      'supabase',
    )
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'Idempotency-Key' },
      'idempotency',
    )
    .addTag('health')
    .addTag('auth')
    .addTag('reseller')
    .addTag('admin')
    .addTag('public')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (_controller, method) => method,
  });

  document.components = document.components ?? {};
  document.components.schemas = {
    ...document.components.schemas,
    ApiError: {
      type: 'object',
      required: ['code', 'message'],
      properties: {
        code: { type: 'string', example: 'VALIDATION_FAILED' },
        message: { type: 'string', example: 'Dados inválidos' },
        fields: {
          type: 'array',
          items: {
            type: 'object',
            required: ['path', 'code', 'message'],
            properties: {
              path: { type: 'string', example: 'items.0.qty' },
              code: { type: 'string', example: 'too_small' },
              message: { type: 'string', example: 'Deve ser ≥ 1' },
            },
          },
        },
      },
    },
    CursorPage: {
      type: 'object',
      required: ['items', 'nextCursor'],
      properties: {
        items: { type: 'array', items: {} },
        nextCursor: { type: 'string', nullable: true, example: null },
      },
    },
  };

  // Global prefix is `api` → UI at /api/docs, JSON at /api/docs-json.
  SwaggerModule.setup('docs', app, document, {
    useGlobalPrefix: true,
    jsonDocumentUrl: 'docs-json',
  });
}
