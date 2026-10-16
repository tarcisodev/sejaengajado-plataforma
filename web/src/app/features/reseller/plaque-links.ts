/** Canonical plaque URL — hits public /avaliar and records ScanEvent. */
export function plaqueReviewUrl(
  slug: string,
  apiPublicBase = 'https://api.sejaengajado.com.br',
): string {
  const base = apiPublicBase.replace(/\/$/, '');
  return `${base}/api/public/r/${encodeURIComponent(slug.trim().toLowerCase())}/avaliar`;
}

export function plaqueSiteUrl(slug: string): string {
  return `https://${slug.trim().toLowerCase()}.sejaengajado.com.br/avaliar`;
}

export function plaqueNfcPayload(slug: string, apiPublicBase?: string): string {
  return plaqueReviewUrl(slug, apiPublicBase);
}
