import { isPlatformBrowser } from '@angular/common';
import {
  ErrorHandler,
  inject,
  PLATFORM_ID,
  provideAppInitializer,
  type EnvironmentProviders,
  makeEnvironmentProviders,
} from '@angular/core';
import * as Sentry from '@sentry/angular';

import { scrubSentryEvent } from './scrub';

interface PublicSentryConfig {
  sentryDsn: string | null;
  sentryRelease: string | null;
}

async function loadPublicConfig(): Promise<PublicSentryConfig> {
  try {
    const res = await fetch('/se-public-config.json', { credentials: 'same-origin' });
    if (!res.ok) {
      return { sentryDsn: null, sentryRelease: null };
    }
    return (await res.json()) as PublicSentryConfig;
  } catch {
    return { sentryDsn: null, sentryRelease: null };
  }
}

/** Browser Sentry: DSN vem do SSR (arquivo *_FILE no container) via /se-public-config.json. */
export function provideSentry(): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: ErrorHandler,
      useValue: Sentry.createErrorHandler({ showDialog: false }),
    },
    provideAppInitializer(async () => {
      if (!isPlatformBrowser(inject(PLATFORM_ID))) {
        return;
      }
      const cfg = await loadPublicConfig();
      if (!cfg.sentryDsn) {
        return;
      }
      Sentry.init({
        dsn: cfg.sentryDsn,
        release: cfg.sentryRelease ?? undefined,
        beforeSend: (event) => scrubSentryEvent(event),
        ...({ sendDefaultPii: false } as object),
      });
    }),
  ]);
}
