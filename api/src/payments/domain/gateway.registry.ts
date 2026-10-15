import type { PaymentGateway } from './payment-gateway.port';

const byCode = new Map<string, PaymentGateway>();

export function registerPaymentGateway(gateway: PaymentGateway): void {
  byCode.set(gateway.code, gateway);
}

export function getPaymentGateway(code: string): PaymentGateway {
  const gateway = byCode.get(code);
  if (!gateway) {
    throw new Error(`PaymentGateway desconhecido: ${code}`);
  }
  return gateway;
}

export function listPaymentGatewayCodes(): string[] {
  return [...byCode.keys()];
}

/** Test helper — clears registry between suites. */
export function clearPaymentGatewayRegistry(): void {
  byCode.clear();
}
