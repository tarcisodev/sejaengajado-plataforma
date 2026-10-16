import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { loadPublicConfig } from '../config/public-config';
import { environment } from '../../../environments/environment';

let client: SupabaseClient | null = null;
let initPromise: Promise<SupabaseClient | null> | null = null;

async function resolveCredentials(): Promise<{ url: string; anon: string } | null> {
  const fromEnvUrl = environment.supabaseUrl?.trim();
  const fromEnvAnon = environment.supabaseAnonKey?.trim();
  if (fromEnvUrl && fromEnvAnon) {
    return { url: fromEnvUrl, anon: fromEnvAnon };
  }
  const cfg = await loadPublicConfig();
  const url = (cfg.supabaseUrl ?? fromEnvUrl ?? '').trim();
  const anon = (cfg.supabaseAnonKey ?? fromEnvAnon ?? '').trim();
  if (!url || !anon) {
    return null;
  }
  return { url, anon };
}

/** Browser Supabase client (anon key only). Used to attach JWT to API calls. */
export function getSupabaseBrowser(): SupabaseClient | null {
  return client;
}

/** Ensure the browser client exists (runtime config may load async). */
export async function ensureSupabaseBrowser(): Promise<SupabaseClient | null> {
  if (client) {
    return client;
  }
  if (!initPromise) {
    initPromise = (async () => {
      const creds = await resolveCredentials();
      if (!creds) {
        return null;
      }
      client = createClient(creds.url, creds.anon, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
      return client;
    })().finally(() => {
      initPromise = null;
    });
  }
  return initPromise;
}

export async function accessTokenFromSupabase(): Promise<string | null> {
  const sb = await ensureSupabaseBrowser();
  if (!sb) {
    return null;
  }
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? null;
}
