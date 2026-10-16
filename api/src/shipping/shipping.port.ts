export interface ShippingQuoteOption {
  serviceId: string;
  name: string;
  company: string;
  /** Centavos — never float BRL in domain. */
  priceCents: number;
  deliveryDays: number;
}

export interface ShippingQuoteInput {
  destinationCep: string;
  insuranceCents: number;
  quantity?: number;
}

export const SHIPPING_PROVIDER = Symbol('SHIPPING_PROVIDER');

export interface ShippingProvider {
  readonly code: string;
  quote(input: ShippingQuoteInput): Promise<ShippingQuoteOption[]>;
}
