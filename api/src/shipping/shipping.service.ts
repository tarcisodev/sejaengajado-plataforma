import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

import { ADMIN_PRISMA, type AdminPrisma } from '../tenant/prisma.module';
import {
  SHIPPING_PROVIDER,
  type ShippingProvider,
  type ShippingQuoteOption,
} from './shipping.port';

const CEP_DIGITS = /^\d{8}$/;

@Injectable()
export class ShippingService {
  constructor(
    @Inject(SHIPPING_PROVIDER) private readonly provider: ShippingProvider,
    @Inject(ADMIN_PRISMA) private readonly adminDb: AdminPrisma,
  ) {}

  async quoteDestination(destinationCep: string, quantity = 1): Promise<{
    originCep: string;
    options: ShippingQuoteOption[];
  }> {
    const cep = normalizeCep(destinationCep);
    if (!cep) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'CEP de destino inválido',
      });
    }

    const insuranceCents = await this.plaqueInsuranceCents();
    try {
      const options = await this.provider.quote({
        destinationCep: cep,
        insuranceCents,
        quantity,
      });
      return { originCep: '38035-080', options };
    } catch {
      throw new ServiceUnavailableException({
        code: 'SHIPPING_UNAVAILABLE',
        message: 'Cotação de frete indisponível. Tente de novo.',
      });
    }
  }

  /**
   * Re-quote and pick the selected service — never trust client priceCents.
   */
  async resolveSelected(
    destinationCep: string,
    serviceId: string,
    quantity = 1,
  ): Promise<ShippingQuoteOption> {
    const { options } = await this.quoteDestination(destinationCep, quantity);
    const selected = options.find((opt) => opt.serviceId === serviceId);
    if (!selected) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Opção de frete inválida ou expirada. Cotar de novo.',
      });
    }
    return selected;
  }

  private async plaqueInsuranceCents(): Promise<number> {
    const cfg = await this.adminDb.platformConfig.findUnique({
      where: { id: 'default' },
      select: { plaqueValueCents: true },
    });
    return cfg?.plaqueValueCents ?? 9_900;
  }
}

export function normalizeCep(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  return CEP_DIGITS.test(digits) ? digits : null;
}
