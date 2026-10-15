import type { ErrorEvent, EventHint } from '@sentry/nestjs';

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const BEARER_RE = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;
const JWT_RE = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

const SENSITIVE_HEADER =
  /^(authorization|cookie|set-cookie|x-api-key|asaas-access-token|x-supabase-auth)$/i;

function scrubString(value: string): string {
  return value
    .replace(EMAIL_RE, '[email]')
    .replace(BEARER_RE, 'Bearer [token]')
    .replace(JWT_RE, '[jwt]');
}

function scrubUnknown(value: unknown, depth = 0): unknown {
  if (depth > 6 || value == null) {
    return value;
  }
  if (typeof value === 'string') {
    return scrubString(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => scrubUnknown(item, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (/^(email|password|token|access_token|refresh_token|authorization|cookie|ip)$/i.test(key)) {
        out[key] = '[Redacted]';
        continue;
      }
      out[key] = scrubUnknown(nested, depth + 1);
    }
    return out;
  }
  return value;
}

/** Drop PII before send: e-mail, IP, tokens/headers. */
export function scrubSentryEvent(event: ErrorEvent, _hint?: EventHint): ErrorEvent | null {
  if (event.request) {
    delete event.request.cookies;
    delete event.request.env;
    if (event.request.headers) {
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(event.request.headers)) {
        if (SENSITIVE_HEADER.test(key)) {
          headers[key] = '[Redacted]';
        } else if (typeof value === 'string') {
          headers[key] = scrubString(value);
        }
      }
      event.request.headers = headers;
    }
    if (typeof event.request.query_string === 'string') {
      event.request.query_string = scrubString(event.request.query_string);
    }
    if (event.request.data != null) {
      event.request.data = scrubUnknown(event.request.data);
    }
  }

  if (event.user) {
    delete event.user.email;
    delete event.user.ip_address;
    delete event.user.username;
    if (event.user.id) {
      // keep opaque id only
    }
  }

  delete event.server_name;

  if (event.extra) {
    event.extra = scrubUnknown(event.extra) as typeof event.extra;
  }
  if (event.contexts) {
    event.contexts = scrubUnknown(event.contexts) as typeof event.contexts;
  }
  if (typeof event.message === 'string') {
    event.message = scrubString(event.message);
  }

  return event;
}
