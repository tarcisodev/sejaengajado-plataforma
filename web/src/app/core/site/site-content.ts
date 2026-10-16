import type {
  DayHours,
  SiteContent,
  SiteGalleryImage,
  SiteHours,
  SiteModules,
  SiteProduct,
  SiteWeeklyHours,
  WeekdayKey,
} from '../models/domain';

/** Helpers puros (SSR-safe) para ler o conteúdo do biosite com compatibilidade de legado. */

export const WEEKDAYS: readonly { key: WeekdayKey; short: string; long: string }[] = [
  { key: 'mon', short: 'Seg', long: 'Segunda' },
  { key: 'tue', short: 'Ter', long: 'Terça' },
  { key: 'wed', short: 'Qua', long: 'Quarta' },
  { key: 'thu', short: 'Qui', long: 'Quinta' },
  { key: 'fri', short: 'Sex', long: 'Sexta' },
  { key: 'sat', short: 'Sáb', long: 'Sábado' },
  { key: 'sun', short: 'Dom', long: 'Domingo' },
];

export function defaultWeeklyHours(): SiteWeeklyHours {
  return {
    mon: { open: '08:00', close: '18:00' },
    tue: { open: '08:00', close: '18:00' },
    wed: { open: '08:00', close: '18:00' },
    thu: { open: '08:00', close: '18:00' },
    fri: { open: '08:00', close: '18:00' },
    sat: { open: '08:00', close: '12:00' },
    sun: null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function asDayHours(value: unknown): DayHours | null | undefined {
  if (value === null) {
    return null;
  }
  if (isRecord(value) && typeof value['open'] === 'string' && typeof value['close'] === 'string') {
    return { open: value['open'], close: value['close'] };
  }
  return undefined;
}

/** Horário semanal estruturado: `weeklyHours` ou `hours` no formato objeto da API. */
export function weeklyHoursOf(content: SiteContent | null | undefined): SiteWeeklyHours | undefined {
  if (!content) {
    return undefined;
  }
  const raw: unknown = isRecord(content.weeklyHours)
    ? content.weeklyHours
    : isRecord(content.hours as unknown)
      ? (content.hours as unknown)
      : undefined;
  if (!isRecord(raw)) {
    return undefined;
  }
  const out: SiteWeeklyHours = {};
  let any = false;
  for (const day of WEEKDAYS) {
    const parsed = asDayHours(raw[day.key]);
    if (parsed !== undefined) {
      out[day.key] = parsed;
      any = true;
    }
  }
  return any ? out : undefined;
}

/** Linhas de horário legado (FORMULA: lista `{dias, abre, fecha}`). */
export function legacyHoursOf(content: SiteContent | null | undefined): SiteHours[] {
  const hours = content?.hours as unknown;
  if (!Array.isArray(hours)) {
    return [];
  }
  return hours.filter(
    (row): row is SiteHours => isRecord(row) && typeof row['dias'] === 'string',
  );
}

/** Agrupa dias consecutivos com o mesmo horário: "Seg a Sex: 08:00–18:00". */
export function weeklyHourLines(weekly: SiteWeeklyHours | undefined): string[] {
  if (!weekly) {
    return [];
  }
  const lines: string[] = [];
  let i = 0;
  while (i < WEEKDAYS.length) {
    const day = WEEKDAYS[i];
    const value = weekly[day.key];
    if (value === undefined) {
      i++;
      continue;
    }
    const label = value ? `${value.open}–${value.close}` : 'Fechado';
    let j = i;
    while (j + 1 < WEEKDAYS.length) {
      const next = weekly[WEEKDAYS[j + 1].key];
      if (next === undefined) {
        break;
      }
      const nextLabel = next ? `${next.open}–${next.close}` : 'Fechado';
      if (nextLabel !== label) {
        break;
      }
      j++;
    }
    const days = j === i ? day.short : `${day.short} a ${WEEKDAYS[j].short}`;
    lines.push(`${days}: ${label}`);
    i = j + 1;
  }
  return lines;
}

export function galleryImages(content: SiteContent | null | undefined): SiteGalleryImage[] {
  const raw = (content?.gallery ?? []) as unknown[];
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: SiteGalleryImage[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && item.trim()) {
      out.push({ url: item.trim() });
    } else if (isRecord(item) && typeof item['url'] === 'string' && item['url'].trim()) {
      out.push({
        url: item['url'].trim(),
        alt: typeof item['alt'] === 'string' ? item['alt'] : undefined,
      });
    }
  }
  return out;
}

/** Módulo ligado? Sem flag explícita = ligado (sites antigos). */
export function moduleOn(content: SiteContent | null | undefined, key: keyof SiteModules): boolean {
  const flags = content?.modules;
  if (!isRecord(flags)) {
    return true;
  }
  return flags[key] !== false;
}

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** "29,90" | "R$ 1.299,90" | "29.9" → centavos inteiros; vazio/ inválido → null. */
export function parseBrlToCents(text: string): number | null {
  const cleaned = text.replace(/[^\d.,]/g, '');
  if (!cleaned) {
    return null;
  }
  let normalized = cleaned;
  if (cleaned.includes(',')) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if ((cleaned.match(/\./g) ?? []).length > 1) {
    normalized = cleaned.replace(/\./g, '');
  }
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }
  return Math.round(value * 100);
}

/** Valor do input em reais (pt-BR, sem "R$"): 2990 → "29,90". */
export function centsToInput(cents: number | null | undefined): string {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) {
    return '';
  }
  return (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Centavos do item: `precoCentavos` (nome oficial do schema da API); `priceCents` só como legado. */
export function productCents(product: SiteProduct): number | null {
  const value = product.precoCentavos ?? product.priceCents;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function productPriceLabel(product: SiteProduct): string {
  const cents = productCents(product);
  if (cents !== null) {
    return formatCents(cents);
  }
  return product.precoTexto?.trim() ?? '';
}

/** Texto alternativo da foto: `alt` (oficial); `fotoAlt` só como legado; fallback no nome. */
export function productAlt(product: SiteProduct): string {
  return (product.alt || product.fotoAlt || product.nome || '').trim();
}

/** Depoimentos: `{nome, texto}` (oficial do schema da API); `{name, text}` só como legado. */
export function testimonialsOf(
  content: SiteContent | null | undefined,
): { name: string; text: string }[] {
  const raw = content?.testimonials as unknown;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter(isRecord)
    .map((item) => ({
      name: String(item['nome'] ?? item['name'] ?? '').trim(),
      text: String(item['texto'] ?? item['text'] ?? '').trim(),
    }))
    .filter((item) => item.text);
}

/** Link do Maps: `mapsUrl` (topo) ou `address.mapsUrl` (schema da API). */
export function mapsUrlOf(content: SiteContent | null | undefined): string {
  return (content?.mapsUrl || content?.address?.mapsUrl || '').trim();
}

export function pixKeyOf(content: SiteContent | null | undefined): string {
  const pix = content?.pix;
  return (pix?.chave || pix?.key || '').trim();
}

export function pixNameOf(content: SiteContent | null | undefined): string {
  const pix = content?.pix;
  return (pix?.nome || pix?.receiverName || '').trim();
}

/** Só dígitos; 10–11 dígitos (DDD + número) ganham o 55 do Brasil. */
export function normalizeWhatsapp(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
}

/**
 * Normaliza um link digitado pelo usuário (alinhado à API: http(s), mailto, tel ou caminho "/").
 * - vazio → `''`
 * - `https://`, `http://`, `mailto:`, `tel:` e caminhos `/...` ficam como estão
 * - `//host/x` → `https://host/x`; sem esquema (ex.: `instagram.com/x`) → `https://instagram.com/x`
 * - qualquer outro esquema (`javascript:`, `data:`, `ftp:`...) → `null` (inválido)
 */
export function normalizeUrl(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim();
  if (!value) {
    return '';
  }
  if (/^(https?:\/\/|mailto:|tel:)/i.test(value)) {
    return value;
  }
  if (value.startsWith('//')) {
    return `https:${value}`;
  }
  if (value.startsWith('/')) {
    return value;
  }
  // Esquema explícito (`javascript:`, `data:`...). `host:porta` (dígito após ":") não é esquema.
  if (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(value)) {
    return null;
  }
  if (/\s/.test(value)) {
    return null;
  }
  return `https://${value}`;
}

/** Mensagem pt-BR para link recusado por `normalizeUrl`. */
export const INVALID_URL_SCHEME_MESSAGE =
  'Link não permitido. Use um endereço https://, mailto: ou tel:.';

/** Parece um endereço (tem esquema, `//` ou `dominio.tld/`) e não um @perfil. */
export function looksLikeUrl(raw: string): boolean {
  const value = raw.trim();
  return (
    /^[a-z][a-z0-9+.-]*:(?!\d)/i.test(value) ||
    value.startsWith('//') ||
    /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(:\d+)?\//i.test(value)
  );
}

export function socialLabel(tipo: string): string {
  const labels: Record<string, string> = {
    instagram: 'Instagram',
    facebook: 'Facebook',
    tiktok: 'TikTok',
    youtube: 'YouTube',
    linkedin: 'LinkedIn',
    site: 'Site',
    x: 'X',
  };
  return labels[tipo] ?? tipo;
}

export function mapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
