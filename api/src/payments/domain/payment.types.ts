/** Billing methods supported by the PaymentGateway port (MVP). */
export type BillingMethod = 'PIX' | 'BOLETO' | 'CARD';

/** Normalized payment status (gateway-agnostic). */
export type PaymentStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'RECEIVED'
  | 'OVERDUE'
  | 'REFUNDED'
  | 'FAILED'
  | 'CANCELLED';

export interface CreateCustomerInput {
  name: string;
  email: string;
  /** Digits only; never log. */
  cpfCnpj?: string;
  externalReference?: string;
}

export interface CreateCustomerResult {
  gatewayCustomerId: string;
}

export interface CreateChargeInput {
  gatewayCustomerId: string;
  /** Positive integer centavos — never float/Decimal. */
  amountCents: number;
  method: BillingMethod;
  /** Calendar date `YYYY-MM-DD` (Asaas due date). */
  dueDate: string;
  description: string;
  /** Required on charge creation; sent as Idempotency-Key. */
  idempotencyKey: string;
  externalReference?: string;
}

export interface CreateChargeResult {
  gatewayPaymentId: string;
  status: PaymentStatus;
  invoiceUrl?: string | null;
  bankSlipUrl?: string | null;
  pixQrCode?: string | null;
  pixCopyPaste?: string | null;
}

export interface CreateSubscriptionInput {
  gatewayCustomerId: string;
  amountCents: number;
  cycle: 'MONTHLY';
  nextDueDate: string;
  description: string;
  idempotencyKey: string;
  billingType?: BillingMethod;
  externalReference?: string;
}

export interface CreateSubscriptionResult {
  gatewaySubscriptionId: string;
  status: string;
}

export interface GetPaymentResult {
  gatewayPaymentId: string;
  status: PaymentStatus;
  amountCents: number;
  invoiceUrl?: string | null;
  bankSlipUrl?: string | null;
}

export interface RefundInput {
  gatewayPaymentId: string;
  /** Partial refund in centavos; omit for full refund. */
  amountCents?: number;
  idempotencyKey: string;
}

export function assertPositiveCents(amountCents: number, path = 'amountCents'): void {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error(`${path} must be a positive integer (centavos)`);
  }
}
