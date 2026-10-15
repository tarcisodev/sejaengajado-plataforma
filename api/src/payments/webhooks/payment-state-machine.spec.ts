import {
  applyPaymentTransition,
  canTransition,
  gatewayStatusToDb,
} from './payment-state-machine';

describe('payment state machine', () => {
  it('maps CONFIRMED and RECEIVED to PAID', () => {
    expect(gatewayStatusToDb('CONFIRMED')).toBe('PAID');
    expect(gatewayStatusToDb('RECEIVED')).toBe('PAID');
  });

  it('allows PENDING → PAID and PAID → REFUNDED', () => {
    expect(canTransition('PENDING', 'PAID')).toBe(true);
    expect(canTransition('PAID', 'REFUNDED')).toBe(true);
    expect(canTransition('PAID', 'PENDING')).toBe(false);
    expect(canTransition('REFUNDED', 'PAID')).toBe(false);
  });

  it('RECEIVED after CONFIRMED (both PAID) does not regress', () => {
    const first = applyPaymentTransition('PENDING', 'CONFIRMED');
    expect(first).toEqual({ ok: true, next: 'PAID', changed: true });
    const second = applyPaymentTransition('PAID', 'RECEIVED');
    expect(second).toEqual({ ok: true, next: 'PAID', changed: false });
  });

  it('rejects invalid transitions', () => {
    expect(applyPaymentTransition('PAID', 'PENDING')).toEqual({
      ok: false,
      reason: 'INVALID_TRANSITION',
    });
    expect(applyPaymentTransition('REFUNDED', 'RECEIVED')).toEqual({
      ok: false,
      reason: 'INVALID_TRANSITION',
    });
  });
});
