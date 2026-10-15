import type { BillingMethod, PaymentStatus } from '../../domain/payment.types';

const STATUS_MAP: Record<string, PaymentStatus> = {
  PENDING: 'PENDING',
  AWAITING_RISK_ANALYSIS: 'PENDING',
  AWAITING_CHARGEBACK_REVERSAL: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  RECEIVED: 'RECEIVED',
  RECEIVED_IN_CASH: 'RECEIVED',
  OVERDUE: 'OVERDUE',
  REFUNDED: 'REFUNDED',
  REFUND_REQUESTED: 'PENDING',
  REFUND_IN_PROGRESS: 'PENDING',
  CHARGEBACK_REQUESTED: 'FAILED',
  CHARGEBACK_DISPUTE: 'FAILED',
  DUNNING_REQUESTED: 'OVERDUE',
  DUNNING_RECEIVED: 'RECEIVED',
  DELETED: 'CANCELLED',
};

export function mapAsaasPaymentStatus(status: string): PaymentStatus {
  return STATUS_MAP[status] ?? 'PENDING';
}

export function toAsaasBillingType(method: BillingMethod): string {
  if (method === 'CARD') {
    return 'CREDIT_CARD';
  }
  return method;
}
