import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { environment } from '../../../environments/environment';

let client: SupabaseClient | null = null;

/** Browser Supabase client (anon key only). Used to attach JWT to API calls. */
export function getSupabaseBrowser(): SupabaseClient | null {
  const url = environment.supabaseUrl?.trim();
  const anon = environment.supabaseAnonKey?.trim();
  if (!url || !anon) {
    return null;
  }
  if (!client) {
    client = createClient(url, anon, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}

export async function accessTokenFromSupabase(): Promise<string | null> {
  const sb = getSupabaseBrowser();
  if (!sb) {
    return null;
  }
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? null;
}
