import { Injectable } from '@nestjs/common';

import type { PaymentGateway } from './payment-gateway.port';
import {
  assertPositiveCents,
  type CreateChargeInput,
  type CreateChargeResult,
  type CreateCustomerInput,
  type CreateCustomerResult,
  type CreateSubscriptionInput,
  type CreateSubscriptionResult,
  type GetPaymentResult,
  type RefundInput,
} from './payment.types';

@Injectable()
export class FakeGateway implements PaymentGateway {
  readonly code = 'fake';

  readonly customers: CreateCustomerInput[] = [];
  readonly charges: CreateChargeInput[] = [];
  readonly subscriptions: CreateSubscriptionInput[] = [];
  readonly refunds: RefundInput[] = [];
  readonly cancelledSubscriptions: string[] = [];

  private readonly payments = new Map<string, GetPaymentResult>();

  async createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult> {
    this.customers.push(input);
    const gatewayCustomerId = `fake_cus_${this.customers.length}`;
    return { gatewayCustomerId };
  }

  async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
    assertPositiveCents(input.amountCents);
    if (!input.idempotencyKey?.trim()) {
      throw new Error('Idempotency-Key obrigatória');
    }
    this.charges.push(input);
    const gatewayPaymentId = `fake_pay_${this.charges.length}`;
    const result: CreateChargeResult = {
      gatewayPaymentId,
      status: 'PENDING',
      invoiceUrl: `https://fake.local/i/${gatewayPaymentId}`,
      bankSlipUrl: input.method === 'BOLETO' ? `https://fake.local/b/${gatewayPaymentId}` : null,
      pixQrCode: input.method === 'PIX' ? 'fake-qr' : null,
      pixCopyPaste: input.method === 'PIX' ? 'fake-pix-copy' : null,
    };
    this.payments.set(gatewayPaymentId, {
      gatewayPaymentId,
      status: result.status,
      amountCents: input.amountCents,
      invoiceUrl: result.invoiceUrl,
      bankSlipUrl: result.bankSlipUrl,
    });
    return result;
  }

  async createSubscription(
    input: CreateSubscriptionInput,
  ): Promise<CreateSubscriptionResult> {
    assertPositiveCents(input.amountCents);
    if (!input.idempotencyKey?.trim()) {
      throw new Error('Idempotency-Key obrigatória');
    }
    this.subscriptions.push(input);
    return {
      gatewaySubscriptionId: `fake_sub_${this.subscriptions.length}`,
      status: 'ACTIVE',
    };
  }

  async cancelSubscription(gatewaySubscriptionId: string): Promise<void> {
    this.cancelledSubscriptions.push(gatewaySubscriptionId);
  }

  async getPayment(gatewayPaymentId: string): Promise<GetPaymentResult> {
    const found = this.payments.get(gatewayPaymentId);
    if (!found) {
      throw new Error(`Pagamento fake não encontrado: ${gatewayPaymentId}`);
    }
    return found;
  }

  async refund(input: RefundInput): Promise<GetPaymentResult> {
    if (!input.idempotencyKey?.trim()) {
      throw new Error('Idempotency-Key obrigatória');
    }
    if (input.amountCents !== undefined) {
      assertPositiveCents(input.amountCents);
    }
    this.refunds.push(input);
    const current = await this.getPayment(input.gatewayPaymentId);
    const next: GetPaymentResult = { ...current, status: 'REFUNDED' };
    this.payments.set(input.gatewayPaymentId, next);
    return next;
  }

  /** Mark a payment as paid (test helper). */
  markPaid(gatewayPaymentId: string): void {
    this.setPaymentStatus(gatewayPaymentId, 'RECEIVED');
  }

  /** Seed / update remote payment status for webhook reconsulta tests. */
  setPaymentStatus(
    gatewayPaymentId: string,
    status: GetPaymentResult['status'],
    amountCents = 100,
  ): void {
    const current = this.payments.get(gatewayPaymentId);
    this.payments.set(gatewayPaymentId, {
      gatewayPaymentId,
      status,
      amountCents: current?.amountCents ?? amountCents,
      invoiceUrl: current?.invoiceUrl ?? null,
      bankSlipUrl: current?.bankSlipUrl ?? null,
    });
  }

  reset(): void {
    this.customers.length = 0;
    this.charges.length = 0;
    this.subscriptions.length = 0;
    this.refunds.length = 0;
    this.cancelledSubscriptions.length = 0;
    this.payments.clear();
  }
}
