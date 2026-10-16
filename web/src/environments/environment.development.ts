export const environment = {
  /**
   * Same-origin `/api` → proxy.conf.json → Nest local.
   * Auth (Supabase/GoTrue) vem de `/se-public-config.json` (gerado por scripts/dev-auth.mjs).
   */
  apiUrl: '/api',
  supabaseUrl: '',
  supabaseAnonKey: '',
  googlePlacesApiKey: '',
};
