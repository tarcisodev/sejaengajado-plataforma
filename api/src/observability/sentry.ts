import * as Sentry from '@sentry/nestjs';

import type { Env } from '../config/env';
import { scrubSentryEvent } from './sentry-scrub';

export function resolveRelease(source: NodeJS.ProcessEnv = process.env): string | undefined {
  const raw = source.SENTRY_RELEASE || source.IMAGE_TAG || source.GITHUB_SHA;
  return raw && raw.trim().length > 0 ? raw.trim() : undefined;
}

export function initSentry(env: Pick<Env, 'SENTRY_DSN' | 'NODE_ENV'>, release = resolveRelease()): void {
  if (!env.SENTRY_DSN) {
    return;
  }
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    release,
    beforeSend: scrubSentryEvent,
    // Explicit no-PII (SDK default); kept for ops review / future SDK typings.
    ...({ sendDefaultPii: false } as object),
  });
}
