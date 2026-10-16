/** Per-request SSR context (via REQUEST_CONTEXT). Never useValue at app root. */
export interface SsrRequestContext {
  /** Prefetched by-host JSON from Express; null when not a tenant host. */
  publicSite: Record<string, unknown> | null;
  /** Set when Host/query resolved to a tenant slug (prefetch expected). */
  tenantSlug: string | null;
}
