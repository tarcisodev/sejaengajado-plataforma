import { FakeGateway } from './domain/fake-gateway';
import { resolvePaymentGateway } from './payments.module';

describe('resolvePaymentGateway', () => {
  it('uses FakeGateway outside production when Asaas key is absent', () => {
    const fake = new FakeGateway();
    const gateway = resolvePaymentGateway(
      {
        NODE_ENV: 'test',
        ASAAS_API_KEY: undefined,
      } as never,
      fake,
    );
    expect(gateway).toBe(fake);
    expect(gateway.code).toBe('fake');
  });

  it('forbids FakeGateway in production without Asaas key', () => {
    expect(() =>
      resolvePaymentGateway(
        { NODE_ENV: 'production', ASAAS_API_KEY: undefined } as never,
        new FakeGateway(),
      ),
    ).toThrow(/FakeGateway proibido em produção/);
  });

  it('uses Asaas when API key is present', () => {
    const gateway = resolvePaymentGateway(
      {
        NODE_ENV: 'production',
        ASAAS_API_KEY: 'key-from-file',
        ASAAS_BASE_URL: 'https://sandbox.asaas.com/api/v3',
      } as never,
      new FakeGateway(),
    );
    expect(gateway.code).toBe('asaas');
  });
});
