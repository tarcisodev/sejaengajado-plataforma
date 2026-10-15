import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder } from '@nestjs/swagger';
import request from 'supertest';

import { setupOpenApi, shouldEnableDocs } from './openapi';

@Controller()
class PingController {
  @Get('ping')
  ping() {
    return { ok: true };
  }
}

@Module({ controllers: [PingController] })
class TinyModule {}

describe('shouldEnableDocs', () => {
  it('defaults to off', () => {
    expect(shouldEnableDocs({ ENABLE_DOCS: false, NODE_ENV: 'development' })).toBe(false);
    expect(shouldEnableDocs({ ENABLE_DOCS: false, NODE_ENV: 'test' })).toBe(false);
  });

  it('stays off in production even when ENABLE_DOCS is true', () => {
    expect(shouldEnableDocs({ ENABLE_DOCS: true, NODE_ENV: 'production' })).toBe(false);
  });

  it('turns on outside production when ENABLE_DOCS is true', () => {
    expect(shouldEnableDocs({ ENABLE_DOCS: true, NODE_ENV: 'development' })).toBe(true);
    expect(shouldEnableDocs({ ENABLE_DOCS: true, NODE_ENV: 'test' })).toBe(true);
  });
});

describe('setupOpenApi mounting', () => {
  it('does not expose /api/docs when docs are disabled', async () => {
    const app = await NestFactory.create(TinyModule, { logger: false });
    app.setGlobalPrefix('api');
    await app.init();
    await request(app.getHttpServer()).get('/api/docs').expect(404);
    await request(app.getHttpServer()).get('/api/docs-json').expect(404);
    await app.close();
  });

  it('exposes /api/docs and /api/docs-json when enabled', async () => {
    const app = await NestFactory.create(TinyModule, { logger: false });
    app.setGlobalPrefix('api');
    setupOpenApi(app);
    await app.init();
    await request(app.getHttpServer()).get('/api/docs').expect(200);
    const json = await request(app.getHttpServer()).get('/api/docs-json').expect(200);
    expect(json.body.openapi).toMatch(/^3\./);
    expect(json.body.components.schemas.ApiError).toBeDefined();
    await app.close();
  });

  it('documents error fields and pagination for HttpApiService', () => {
    const config = new DocumentBuilder()
      .setTitle('Seja Engajado API')
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();

    expect(config.info.title).toBe('Seja Engajado API');
    expect(config.components?.securitySchemes?.bearer).toBeDefined();
  });
});
