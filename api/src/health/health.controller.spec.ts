import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { ApiExceptionFilter } from '../common/api-exception.filter';
import { HealthController } from './health.controller';
import { READY_PROBE, type ReadyProbe } from './ready';

describe('HealthController', () => {
  async function appWith(ok: boolean): Promise<INestApplication> {
    const probe: ReadyProbe = { check: async () => ok };
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: READY_PROBE, useValue: probe },
        { provide: ApiExceptionFilter, useClass: ApiExceptionFilter },
      ],
    }).compile();
    const app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    return app;
  }

  it('answers liveness with 200', async () => {
    const app = await appWith(false);
    await request(app.getHttpServer()).get('/api/health').expect(200).expect({ status: 'ok' });
    await app.close();
  });

  it('answers ready with 503 when the database is down', async () => {
    const app = await appWith(false);
    const response = await request(app.getHttpServer()).get('/api/health/ready').expect(503);
    expect(response.body).toEqual({ code: 'UNAVAILABLE', message: 'Serviço indisponível' });
    await app.close();
  });

  it('answers ready with 200 when the database is up', async () => {
    const app = await appWith(true);
    await request(app.getHttpServer())
      .get('/api/health/ready')
      .expect(200)
      .expect({ status: 'ok' });
    await app.close();
  });
});
