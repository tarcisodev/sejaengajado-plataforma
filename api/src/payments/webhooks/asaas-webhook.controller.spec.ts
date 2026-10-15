import { UnauthorizedException } from '@nestjs/common';

import { AsaasWebhookController } from './asaas-webhook.controller';
import { WebhookRateLimit } from './webhook-rate-limit';

describe('AsaasWebhookController', () => {
  it('returns 200 body and does not leak token errors', async () => {
    const webhooks = {
      accept: jest.fn().mockResolvedValue({ duplicate: false }),
    };
    const rateLimit = new WebhookRateLimit();
    const controller = new AsaasWebhookController(webhooks as never, rateLimit);
    const req = {
      body: { id: 'e1', payment: { id: 'p1' } },
      headers: {},
      ip: '203.0.113.10',
      socket: { remoteAddress: '203.0.113.10' },
    };
    await expect(
      controller.handle('good-token', req as never),
    ).resolves.toEqual({ ok: true });
    expect(webhooks.accept).toHaveBeenCalledWith('good-token', req.body);
  });

  it('propagates 401 without details', async () => {
    const webhooks = {
      accept: jest.fn().mockRejectedValue(
        new UnauthorizedException({
          code: 'UNAUTHORIZED',
          message: 'Não autenticado',
        }),
      ),
    };
    const controller = new AsaasWebhookController(
      webhooks as never,
      new WebhookRateLimit(),
    );
    await expect(
      controller.handle('bad', {
        body: {},
        headers: {},
        ip: '203.0.113.11',
        socket: {},
      } as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
