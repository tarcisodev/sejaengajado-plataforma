import { Injectable } from '@nestjs/common';

import type {
  PaymentChargeInput,
  PaymentChargeResult,
  PaymentGateway,
} from './payment-gateway';

@Injectable()
export class FakeGateway implements PaymentGateway {
  readonly charges: PaymentChargeInput[] = [];

  async createCharge(input: PaymentChargeInput): Promise<PaymentChargeResult> {
    this.charges.push(input);
    return {
      gatewayChargeId: `fake_${this.charges.length}`,
      status: 'PENDING',
    };
  }

  reset(): void {
    this.charges.length = 0;
  }
}
