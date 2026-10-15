import type { PaymentGateway } from '../../domain/payment-gateway.port';
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
} from '../../domain/payment.types';
import { AsaasClient } from './asaas.client';
import { asaasValueToCents, centsToAsaasValue } from './asaas-money';
import { mapAsaasPaymentStatus, toAsaasBillingType } from './asaas-status';

type AsaasCustomer = { id: string };
type AsaasPayment = {
  id: string;
  status: string;
  value: number;
  invoiceUrl?: string | null;
  bankSlipUrl?: string | null;
};
type AsaasPixQr = { encodedImage?: string; payload?: string };
type AsaasSubscription = { id: string; status: string };

export class AsaasGateway implements PaymentGateway {
  readonly code = 'asaas';

  constructor(private readonly client: AsaasClient) {}

  async createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult> {
    const body: Record<string, string> = {
      name: input.name,
      email: input.email,
    };
    if (input.cpfCnpj) {
      body.cpfCnpj = input.cpfCnpj;
    }
    if (input.externalReference) {
      body.externalReference = input.externalReference;
    }
    const created = await this.client.request<AsaasCustomer>('POST', '/customers', {
      body,
    });
    return { gatewayCustomerId: created.id };
  }

  async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
    assertPositiveCents(input.amountCents);
    if (!input.idempotencyKey?.trim()) {
      throw new Error('Idempotency-Key obrigatória');
    }

    const created = await this.client.request<AsaasPayment>('POST', '/payments', {
      idempotencyKey: input.idempotencyKey,
      body: {
        customer: input.gatewayCustomerId,
        billingType: toAsaasBillingType(input.method),
        value: centsToAsaasValue(input.amountCents),
        dueDate: input.dueDate,
        description: input.description,
        externalReference: input.externalReference,
      },
    });

    let pixQrCode: string | null = null;
    let pixCopyPaste: string | null = null;
    if (input.method === 'PIX') {
      const pix = await this.client.request<AsaasPixQr>(
        'GET',
        `/payments/${created.id}/pixQrCode`,
      );
      pixQrCode = pix.encodedImage ?? null;
      pixCopyPaste = pix.payload ?? null;
    }

    return {
      gatewayPaymentId: created.id,
      status: mapAsaasPaymentStatus(created.status),
      invoiceUrl: created.invoiceUrl ?? null,
      bankSlipUrl: created.bankSlipUrl ?? null,
      pixQrCode,
      pixCopyPaste,
    };
  }

  async createSubscription(
    input: CreateSubscriptionInput,
  ): Promise<CreateSubscriptionResult> {
    assertPositiveCents(input.amountCents);
    if (!input.idempotencyKey?.trim()) {
      throw new Error('Idempotency-Key obrigatória');
    }
    const billingType = toAsaasBillingType(input.billingType ?? 'BOLETO');
    const created = await this.client.request<AsaasSubscription>(
      'POST',
      '/subscriptions',
      {
        idempotencyKey: input.idempotencyKey,
        body: {
          customer: input.gatewayCustomerId,
          billingType,
          value: centsToAsaasValue(input.amountCents),
          nextDueDate: input.nextDueDate,
          cycle: input.cycle,
          description: input.description,
          externalReference: input.externalReference,
        },
      },
    );
    return {
      gatewaySubscriptionId: created.id,
      status: created.status,
    };
  }

  async cancelSubscription(gatewaySubscriptionId: string): Promise<void> {
    await this.client.request('DELETE', `/subscriptions/${gatewaySubscriptionId}`);
  }

  async getPayment(gatewayPaymentId: string): Promise<GetPaymentResult> {
    const payment = await this.client.request<AsaasPayment>(
      'GET',
      `/payments/${gatewayPaymentId}`,
    );
    return {
      gatewayPaymentId: payment.id,
      status: mapAsaasPaymentStatus(payment.status),
      amountCents: asaasValueToCents(payment.value),
      invoiceUrl: payment.invoiceUrl ?? null,
      bankSlipUrl: payment.bankSlipUrl ?? null,
    };
  }

  async refund(input: RefundInput): Promise<GetPaymentResult> {
    if (!input.idempotencyKey?.trim()) {
      throw new Error('Idempotency-Key obrigatória');
    }
    if (input.amountCents !== undefined) {
      assertPositiveCents(input.amountCents);
    }
    const body =
      input.amountCents !== undefined
        ? { value: centsToAsaasValue(input.amountCents) }
        : {};
    const payment = await this.client.request<AsaasPayment>(
      'POST',
      `/payments/${input.gatewayPaymentId}/refund`,
      { idempotencyKey: input.idempotencyKey, body },
    );
    return {
      gatewayPaymentId: payment.id,
      status: mapAsaasPaymentStatus(payment.status),
      amountCents: asaasValueToCents(payment.value),
      invoiceUrl: payment.invoiceUrl ?? null,
      bankSlipUrl: payment.bankSlipUrl ?? null,
    };
  }
}
