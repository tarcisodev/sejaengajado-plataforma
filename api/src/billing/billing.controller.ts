import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth-user';
import { Roles } from '../auth/roles.decorator';
import { BillingQueryService } from './billing-query.service';
import { DirectBillingService } from './direct-billing.service';

type CheckoutMethod = 'PIX' | 'BOLETO' | 'CARD';

interface CheckoutProntoBody {
  siteId?: string;
  customerName?: string;
  customerEmail?: string;
  couponCode?: string;
  method?: CheckoutMethod;
}

/**
 * Direct checkout + payment status polling.
 * Card: only Asaas hosted invoiceUrl — never accept PAN/CVV here.
 */
@Controller('billing')
export class BillingController {
  constructor(
    private readonly direct: DirectBillingService,
    private readonly queries: BillingQueryService,
  ) {}

  @Post('checkout/pronto')
  @Roles('ADMIN', 'CUSTOMER')
  checkoutPronto(@Body() body: CheckoutProntoBody) {
    const method = body.method ?? 'PIX';
    if (method !== 'PIX' && method !== 'BOLETO' && method !== 'CARD') {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Método inválido',
      });
    }
    if (!body.siteId?.trim() || !body.customerName?.trim() || !body.customerEmail?.trim()) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'siteId, customerName e customerEmail são obrigatórios',
      });
    }
    return this.direct.chargePronto({
      siteId: body.siteId.trim(),
      customerName: body.customerName.trim(),
      customerEmail: body.customerEmail.trim(),
      couponCode: body.couponCode,
      method,
    });
  }

  /**
   * Poll gateway status. Never derive paid/failed from the return redirect.
   */
  @Get('payments/:gatewayPaymentId')
  @Roles('ADMIN', 'RESELLER', 'CUSTOMER')
  paymentStatus(
    @Param('gatewayPaymentId') gatewayPaymentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.queries.getPaymentStatus(gatewayPaymentId, user);
  }
}
