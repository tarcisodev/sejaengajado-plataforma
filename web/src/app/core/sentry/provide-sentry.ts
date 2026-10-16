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

import { loadPublicConfig } from '../config/public-config';
import { scrubSentryEvent } from './scrub';

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
