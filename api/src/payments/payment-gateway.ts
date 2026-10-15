export interface PaymentChargeInput {
  amountCents: number;
  idempotencyKey: string;
  description: string;
}

export interface PaymentChargeResult {
  gatewayChargeId: string;
  status: 'PENDING' | 'PAID' | 'FAILED';
}

export interface PaymentGateway {
  createCharge(input: PaymentChargeInput): Promise<PaymentChargeResult>;
}

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
