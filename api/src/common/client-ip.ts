import type { Request } from 'express';

/**
 * Client IP for rate limits.
 * Prefer Cloudflare's CF-Connecting-IP (set by CF, not spoofable by the client).
 * Never use the first X-Forwarded-For hop — clients can forge it.
 * Falls back to Express `req.ip` (honours trust proxy for the Traefik hop).
 */
export function clientIp(req: Request): string {
  const cf = req.headers['cf-connecting-ip'];
  if (typeof cf === 'string' && cf.trim().length > 0) {
    return cf.trim();
  }
  if (Array.isArray(cf) && cf[0]?.trim()) {
    return cf[0].trim();
  }
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}
