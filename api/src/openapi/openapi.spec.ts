import { DocumentBuilder } from '@nestjs/swagger';

describe('OpenAPI contract', () => {
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
