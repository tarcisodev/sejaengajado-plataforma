import { ConflictException, BadRequestException } from '@nestjs/common';

/** `^[a-z0-9](-?[a-z0-9]){2,30}$` — 3–31 chars, lowercase alnum with optional hyphens. */
export const SLUG_REGEX = /^[a-z0-9](-?[a-z0-9]){2,30}$/;

/** Brand / platform names that must never be tenant subdomains. */
export const BRAND_BLOCKLIST = new Set([
  'google',
  'facebook',
  'instagram',
  'whatsapp',
  'youtube',
  'twitter',
  'microsoft',
  'apple',
  'amazon',
  'netflix',
  'uber',
  'ifood',
  'nubank',
  'itau',
  'bradesco',
  'santander',
  'caixa',
  'paypal',
  'picpay',
  'mercadolivre',
  'shopee',
  'tiktok',
  'kwai',
  'telegram',
  'linkedin',
  'github',
  'openai',
  'chatgpt',
  'claude',
  'anthropic',
  'sejaengajado',
]);

export function normalizeSlug(raw: string): string {
  return raw.trim().toLowerCase();
}

export function assertSlugFormat(slug: string): void {
  if (!SLUG_REGEX.test(slug)) {
    throw new BadRequestException({
      code: 'SLUG_INVALID',
      message: 'Slug inválido',
      fields: [{ path: 'slug', code: 'invalid', message: 'Slug inválido' }],
    });
  }
}

export function assertSlugNotBrand(slug: string): void {
  if (BRAND_BLOCKLIST.has(slug)) {
    throw new BadRequestException({
      code: 'SLUG_RESERVED',
      message: 'Slug reservado',
      fields: [{ path: 'slug', code: 'reserved', message: 'Slug reservado' }],
    });
  }
}

export function slugTakenError(): ConflictException {
  return new ConflictException({
    code: 'SLUG_TAKEN',
    message: 'Slug já em uso',
    fields: [{ path: 'slug', code: 'taken', message: 'Slug já em uso' }],
  });
}

export function slugReservedError(): BadRequestException {
  return new BadRequestException({
    code: 'SLUG_RESERVED',
    message: 'Slug reservado',
    fields: [{ path: 'slug', code: 'reserved', message: 'Slug reservado' }],
  });
}
