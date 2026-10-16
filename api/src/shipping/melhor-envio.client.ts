import {
  MELHORENVIO_USER_AGENT,
  PLAQUE_SHIPPING_PRODUCT,
  SHIPPING_ORIGIN_CEP,
} from './shipping.constants';
import { brlToCents, centsToBrl } from './brl-to-cents';
import type { ShippingQuoteOption } from './shipping.port';

export interface MelhorEnvioClientOptions {
  baseUrl: string;
  token: string;
  timeoutMs?: number;
  logger?: { warn: (obj: object, msg: string) => void; error: (obj: object, msg: string) => void };
}

type MelhorEnvioQuoteRow = {
  id?: number | string;
  name?: string;
  company?: { name?: string };
  price?: string | number;
  custom_price?: string | number;
  delivery_time?: number;
  custom_delivery_time?: number;
  error?: string | boolean;
};

export class MelhorEnvioHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'MelhorEnvioHttpError';
  }
}

/**
 * Thin Melhor Envio HTTP client for shipment calculate.
 * Auth: Bearer token; User-Agent obrigatório.
 */
export class MelhorEnvioClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly timeoutMs: number;
  private readonly logger: MelhorEnvioClientOptions['logger'];

  constructor(options: MelhorEnvioClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.token = options.token;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.logger = options.logger;
  }

  async calculate(input: {
    destinationCep: string;
    insuranceCents: number;
    quantity?: number;
  }): Promise<ShippingQuoteOption[]> {
    const qty = input.quantity ?? 1;
    const body = {
      from: { postal_code: digitsOnly(SHIPPING_ORIGIN_CEP) },
      to: { postal_code: digitsOnly(input.destinationCep) },
      products: [
        {
          id: PLAQUE_SHIPPING_PRODUCT.id,
          width: PLAQUE_SHIPPING_PRODUCT.width,
          height: PLAQUE_SHIPPING_PRODUCT.height,
          length: PLAQUE_SHIPPING_PRODUCT.length,
          weight: PLAQUE_SHIPPING_PRODUCT.weight,
          insurance_value: centsToBrl(input.insuranceCents),
          quantity: qty,
        },
      ],
      options: { receipt: false, own_hand: false },
    };

    const rows = await this.postJson<MelhorEnvioQuoteRow[] | { error?: string }>(
      '/api/v2/me/shipment/calculate',
      body,
    );

    if (!Array.isArray(rows)) {
      throw new MelhorEnvioHttpError(502, 'Resposta Melhor Envio inválida');
    }

    return rows
      .filter((row) => !row.error && row.id != null)
      .map((row) => {
        const priceRaw = row.custom_price ?? row.price ?? 0;
        const days = row.custom_delivery_time ?? row.delivery_time ?? 0;
        return {
          serviceId: String(row.id),
          name: row.name?.trim() || `Serviço ${row.id}`,
          company: row.company?.name?.trim() || 'Transportadora',
          priceCents: brlToCents(priceRaw),
          deliveryDays: Number.isFinite(days) ? Math.max(0, Math.trunc(days)) : 0,
        } satisfies ShippingQuoteOption;
      })
      .filter((opt) => opt.priceCents >= 0);
  }

  private async postJson<T>(path: string, body: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
          'User-Agent': MELHORENVIO_USER_AGENT,
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        this.logger?.error({ path, status: response.status }, 'melhorenvio http error');
        throw new MelhorEnvioHttpError(
          response.status,
          `Melhor Envio POST ${path} → ${response.status}`,
        );
      }
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof MelhorEnvioHttpError) {
        throw error;
      }
      this.logger?.error({ path }, 'melhorenvio network error');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}

function digitsOnly(cep: string): string {
  return cep.replace(/\D/g, '');
}
