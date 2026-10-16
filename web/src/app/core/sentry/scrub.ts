const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const BEARER_RE = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;
const JWT_RE = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

function scrubString(value: string): string {
  return value
    .replace(EMAIL_RE, '[email]')
    .replace(BEARER_RE, 'Bearer [token]')
    .replace(JWT_RE, '[jwt]');
}

/** Shared beforeSend scrub for SSR + browser (no e-mail / IP / tokens). */
export function scrubSentryEvent<
  T extends {
    message?: string;
    user?: Record<string, unknown>;
    request?: { headers?: Record<string, string>; cookies?: unknown; data?: unknown };
    server_name?: string;
  },
>(event: T): T | null {
  if (event.request) {
    delete event.request.cookies;
    if (event.request.headers) {
      for (const key of Object.keys(event.request.headers)) {
        if (/^(authorization|cookie|set-cookie|x-api-key)$/i.test(key)) {
          event.request.headers[key] = '[Redacted]';
        } else {
          event.request.headers[key] = scrubString(event.request.headers[key] ?? '');
        }
      }
    }
  }
  if (event.user) {
    delete event.user['email'];
    delete event.user['ip_address'];
    delete event.user['username'];
  }
  delete event.server_name;
  if (typeof event.message === 'string') {
    event.message = scrubString(event.message);
  }
  return event;
}
