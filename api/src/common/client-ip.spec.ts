import { clientIp } from './client-ip';

describe('clientIp', () => {
  it('prefers CF-Connecting-IP over X-Forwarded-For', () => {
    const req = {
      headers: {
        'cf-connecting-ip': '203.0.113.9',
        'x-forwarded-for': '1.2.3.4, 10.0.0.1',
      },
      ip: '10.0.0.1',
      socket: { remoteAddress: '10.0.0.1' },
    };
    expect(clientIp(req as never)).toBe('203.0.113.9');
  });

  it('never trusts the first X-Forwarded-For hop', () => {
    const req = {
      headers: { 'x-forwarded-for': '8.8.8.8, 10.0.0.1' },
      ip: '10.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    };
    expect(clientIp(req as never)).toBe('10.0.0.1');
  });
});
