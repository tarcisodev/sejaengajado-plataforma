import {
  clearPaymentGatewayRegistry,
  getPaymentGateway,
  listPaymentGatewayCodes,
  registerPaymentGateway,
} from './gateway.registry';
import { FakeGateway } from './fake-gateway';
import { runPaymentGatewayContract } from './payment-gateway.contract';

describe('gateway registry', () => {
  afterEach(() => {
    clearPaymentGatewayRegistry();
  });

  it('registers and resolves by code', () => {
    const fake = new FakeGateway();
    registerPaymentGateway(fake);
    expect(getPaymentGateway('fake')).toBe(fake);
    expect(listPaymentGatewayCodes()).toContain('fake');
  });

  it('throws for unknown code', () => {
    expect(() => getPaymentGateway('missing')).toThrow(/desconhecido/);
  });
});

runPaymentGatewayContract('fake', () => new FakeGateway());
