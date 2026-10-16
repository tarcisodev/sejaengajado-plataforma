export const environment = {
  /** Same-origin API in production (Traefik PathPrefix `/api`). */
  apiUrl: '/api',
  /**
   * Public Supabase URL. Empty in the repo — filled at runtime via
   * `/se-public-config.json` (SSR reads `SUPABASE_URL` from the container env).
   */
  supabaseUrl: '',
  /**
   * Anon key (never service_role). Empty in the repo — runtime via
   * `/se-public-config.json` (`SUPABASE_ANON_KEY` env on web-ssr).
   */
  supabaseAnonKey: '',
  /**
   * Browser Google Places key is unused (Places goes through the API).
   * Kept for type parity / local experiments; leave empty in production.
   */
  googlePlacesApiKey: '',
};
