import type {
  CreateChargeInput,
  CreateChargeResult,
  CreateCustomerInput,
  CreateCustomerResult,
  CreateSubscriptionInput,
  CreateSubscriptionResult,
  GetPaymentResult,
  RefundInput,
} from './payment.types';

/**
 * Domain payment port — never import Asaas (or any adapter) from domain code.
 * Adapters live under `payments/adapters/*`.
 */
export interface PaymentGateway {
  readonly code: string;

  createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult>;

  createCharge(input: CreateChargeInput): Promise<CreateChargeResult>;

  createSubscription(
    input: CreateSubscriptionInput,
  ): Promise<CreateSubscriptionResult>;

  cancelSubscription(gatewaySubscriptionId: string): Promise<void>;

  getPayment(gatewayPaymentId: string): Promise<GetPaymentResult>;

  refund(input: RefundInput): Promise<GetPaymentResult>;
}

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
