import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { AuthUser } from '../auth/auth-user';
import {
  PAYMENT_GATEWAY,
  type PaymentGateway,
} from '../payments/domain/payment-gateway.port';
import { requireTenantResellerId } from '../tenant/tenant.context';
import { SYSTEM_PRISMA, type SystemPrisma } from '../tenant/prisma.module';

export interface PaymentStatusDto {
  gatewayPaymentId: string;
  status: string;
  amountCents: number;
  invoiceUrl: string | null;
  bankSlipUrl: string | null;
}

export interface ResellerInvoiceDto {
  id: string;
  period: string;
  status: string;
  totalCents: number;
  dueDate: string | null;
  gatewayPaymentId: string | null;
  paymentStatus: string | null;
  invoiceUrl: string | null;
  bankSlipUrl: string | null;
  pixCopyPaste: string | null;
  lines: {
    description: string;
    qty: number;
    unitCents: number;
    totalCents: number;
  }[];
}

/**
 * Read models for checkout/invoice UIs — amounts always from DB/gateway (centavos).
 * Never invent totals in controllers or the front.
 */
@Injectable()
export class BillingQueryService {
  constructor(
    @Inject(SYSTEM_PRISMA) private readonly db: SystemPrisma,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  async listResellerInvoices(): Promise<ResellerInvoiceDto[]> {
    const resellerId = requireTenantResellerId();
    const rows = await this.db.resellerInvoice.findMany({
      where: { resellerId },
      include: { lines: true },
      orderBy: { period: 'desc' },
    });
    return Promise.all(rows.map((row) => this.toInvoiceDto(row)));
  }

  async getResellerInvoice(id: string): Promise<ResellerInvoiceDto> {
    const resellerId = requireTenantResellerId();
    const row = await this.db.resellerInvoice.findFirst({
      where: { id, resellerId },
      include: { lines: true },
    });
    if (!row) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Fatura não encontrada' });
    }
    return this.toInvoiceDto(row);
  }

  /**
   * Live status from the gateway (reconsulta). Front must poll this — never trust redirect.
   */
  async getPaymentStatus(
    gatewayPaymentId: string,
    actor: AuthUser,
  ): Promise<PaymentStatusDto> {
    await this.assertCanSeePayment(gatewayPaymentId, actor);
    const remote = await this.gateway.getPayment(gatewayPaymentId);
    return {
      gatewayPaymentId: remote.gatewayPaymentId,
      status: remote.status,
      amountCents: remote.amountCents,
      invoiceUrl: remote.invoiceUrl ?? null,
      bankSlipUrl: remote.bankSlipUrl ?? null,
    };
  }

  private async assertCanSeePayment(
    gatewayPaymentId: string,
    actor: AuthUser,
  ): Promise<void> {
    if (actor.role === 'ADMIN') {
      return;
    }

    if (actor.role === 'RESELLER') {
      const resellerId = requireTenantResellerId();
      const invoice = await this.db.resellerInvoice.findFirst({
        where: { gatewayPaymentId, resellerId },
        select: { id: true },
      });
      if (invoice) {
        return;
      }
      const payment = await this.db.payment.findFirst({
        where: { gatewayPaymentId, resellerId },
        select: { id: true },
      });
      if (payment) {
        return;
      }
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Pagamento não encontrado' });
    }

    // CUSTOMER: only direct (platform) payments they can address by id from checkout.
    const payment = await this.db.payment.findFirst({
      where: { gatewayPaymentId },
      select: { id: true, resellerId: true },
    });
    if (!payment) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Pagamento não encontrado' });
    }
    const platform = await this.db.reseller.findFirst({
      where: { isPlatform: true },
      select: { id: true },
    });
    if (!platform || payment.resellerId !== platform.id) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Pagamento não encontrado' });
    }
  }

  private async toInvoiceDto(row: {
    id: string;
    period: string;
    status: string;
    totalCents: number;
    dueDate: Date | null;
    gatewayPaymentId: string | null;
    lines: {
      description: string;
      qty: number;
      unitCents: number;
      totalCents: number;
    }[];
  }): Promise<ResellerInvoiceDto> {
    let paymentStatus: string | null = null;
    let invoiceUrl: string | null = null;
    let bankSlipUrl: string | null = null;
    let pixCopyPaste: string | null = null;

    if (row.gatewayPaymentId) {
      try {
        const remote = await this.gateway.getPayment(row.gatewayPaymentId);
        paymentStatus = remote.status;
        invoiceUrl = remote.invoiceUrl ?? null;
        bankSlipUrl = remote.bankSlipUrl ?? null;
      } catch {
        paymentStatus = null;
      }
    }

    return {
      id: row.id,
      period: row.period,
      status: row.status,
      totalCents: row.totalCents,
      dueDate: row.dueDate?.toISOString() ?? null,
      gatewayPaymentId: row.gatewayPaymentId,
      paymentStatus,
      invoiceUrl,
      bankSlipUrl,
      pixCopyPaste,
      lines: row.lines.map((line) => ({
        description: line.description,
        qty: line.qty,
        unitCents: line.unitCents,
        totalCents: line.totalCents,
      })),
    };
  }
}
