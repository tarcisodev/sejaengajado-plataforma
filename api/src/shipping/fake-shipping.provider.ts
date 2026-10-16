import { Injectable } from '@nestjs/common';

import type {
  ShippingProvider,
  ShippingQuoteInput,
  ShippingQuoteOption,
} from './shipping.port';

/** Dev/test only — never registered when NODE_ENV=production. */
@Injectable()
export class FakeShippingProvider implements ShippingProvider {
  readonly code = 'fake';

  async quote(input: ShippingQuoteInput): Promise<ShippingQuoteOption[]> {
    const digits = input.destinationCep.replace(/\D/g, '');
    if (digits.length !== 8) {
      return [];
    }
    return [
      {
        serviceId: '1',
        name: 'PAC (exemplo)',
        company: 'Correios',
        priceCents: 2_490,
        deliveryDays: 8,
      },
      {
        serviceId: '2',
        name: 'SEDEX (exemplo)',
        company: 'Correios',
        priceCents: 4_190,
        deliveryDays: 3,
      },
    ];
  }
}
