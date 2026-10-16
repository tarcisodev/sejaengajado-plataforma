import type { MelhorEnvioClient } from './melhor-envio.client';
import type {
  ShippingProvider,
  ShippingQuoteInput,
  ShippingQuoteOption,
} from './shipping.port';

export class MelhorEnvioProvider implements ShippingProvider {
  readonly code = 'melhorenvio';

  constructor(private readonly client: MelhorEnvioClient) {}

  quote(input: ShippingQuoteInput): Promise<ShippingQuoteOption[]> {
    return this.client.calculate(input);
  }
}
