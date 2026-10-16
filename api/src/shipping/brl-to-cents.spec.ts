import { brlToCents, centsToBrl } from './brl-to-cents';

describe('brlToCents / centsToBrl', () => {
  it('converts Melhor Envio BRL to centavos', () => {
    expect(brlToCents(19.9)).toBe(1990);
    expect(brlToCents('24.90')).toBe(2490);
    expect(brlToCents('1,99')).toBe(199);
  });

  it('converts centavos to BRL insurance_value', () => {
    expect(centsToBrl(9900)).toBe(99);
    expect(centsToBrl(1)).toBe(0.01);
  });

  it('rejects invalid values', () => {
    expect(() => brlToCents(Number.NaN)).toThrow('valor Melhor Envio inválido');
    expect(() => centsToBrl(1.5)).toThrow('centavos inválidos');
  });
});
