import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import { Public } from '../../auth/public.decorator';
import { clientIp } from '../../common/client-ip';
import { AsaasWebhookService } from './asaas-webhook.service';
import { hashClientIp, WebhookRateLimit } from './webhook-rate-limit';

@Controller('webhooks/asaas')
@Public()
@Throttle({ default: { limit: 60, ttl: 60_000 } })
export class AsaasWebhookController {
  constructor(
    private readonly webhooks: AsaasWebhookService,
    private readonly rateLimit: WebhookRateLimit,
  ) {}

  @Post()
  @HttpCode(200)
  async handle(
    @Headers('asaas-access-token') accessToken: string | undefined,
    @Req() req: Request,
  ): Promise<{ ok: true }> {
    const ip = clientIp(req);
    this.rateLimit.assertAllowed(hashClientIp(ip));

    try {
      await this.webhooks.accept(accessToken, req.body);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      if (error instanceof Error && error.message === 'BODY_TOO_LARGE') {
        throw new BadRequestException({
          code: 'BAD_REQUEST',
          message: 'Requisição inválida',
        });
      }
      throw error;
    }

    return { ok: true };
  }
}
