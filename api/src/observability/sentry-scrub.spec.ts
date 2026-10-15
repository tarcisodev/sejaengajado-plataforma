import { scrubSentryEvent } from './sentry-scrub';

describe('scrubSentryEvent', () => {
  it('removes e-mail, IP and auth headers', () => {
    const event = scrubSentryEvent({
      message: 'fail for user@example.com',
      user: { email: 'user@example.com', ip_address: '1.2.3.4', id: 'u1' },
      request: {
        headers: {
          authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.aaa.bbb',
          cookie: 'session=secret',
          'content-type': 'application/json',
        },
        data: { email: 'a@b.com', token: 'xyz' },
      },
      server_name: 'vps-1',
    } as never);

    expect(event?.message).toContain('[email]');
    expect(event?.user?.email).toBeUndefined();
    expect(event?.user?.ip_address).toBeUndefined();
    expect(event?.user?.id).toBe('u1');
    expect(event?.request?.headers?.authorization).toBe('[Redacted]');
    expect(event?.request?.headers?.cookie).toBe('[Redacted]');
    expect(event?.request?.data).toEqual({ email: '[Redacted]', token: '[Redacted]' });
    expect(event?.server_name).toBeUndefined();
  });
});
