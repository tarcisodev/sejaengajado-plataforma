export interface PublicRuntimeConfig {
  sentryDsn: string | null;
  sentryRelease: string | null;
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
  apiUrl: string | null;
}

let cached: PublicRuntimeConfig | null = null;
let inflight: Promise<PublicRuntimeConfig> | null = null;

const empty: PublicRuntimeConfig = {
  sentryDsn: null,
  sentryRelease: null,
  supabaseUrl: null,
  supabaseAnonKey: null,
  apiUrl: null,
};

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/** Loads SSR-served public config (no secrets). Safe to call from the browser. */
export async function loadPublicConfig(): Promise<PublicRuntimeConfig> {
  if (cached) {
    return cached;
  }
  // Prerender/SSR: nunca fetch relativo (fica pendente em ng-localhost).
  if (!isBrowser()) {
    cached = empty;
    return cached;
  }
  if (inflight) {
    return inflight;
  }
  inflight = (async () => {
    try {
      const res = await fetch('/se-public-config.json', { credentials: 'same-origin' });
      if (!res.ok) {
        cached = empty;
        return cached;
      }
      cached = { ...empty, ...((await res.json()) as Partial<PublicRuntimeConfig>) };
      return cached;
    } catch {
      cached = empty;
      return cached;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
