import { z } from 'zod';

const hexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Cor hexadecimal inválida');

const niche = z.enum([
  'barbearia',
  'restaurante',
  'moda',
  'beleza',
  'saude',
  'generico',
]);

const divisorSchema = z.object({
  shape: z
    .enum([
      'reta',
      'ondulada',
      'zigzag',
      'curva',
      'inclinada',
      'nuvem',
      'serrilhada',
      'none',
    ])
    .default('none'),
  height: z.number().int().min(16).max(120).default(48),
  flip: z.boolean().default(false),
  invert: z.boolean().default(false),
});

const sectionSchema = z.object({
  type: z.string().min(1),
  divisor: divisorSchema.optional(),
});

const dayHours = z
  .object({
    open: z.string().regex(/^\d{2}:\d{2}$/),
    close: z.string().regex(/^\d{2}:\d{2}$/),
  })
  .nullable();

const hoursSchema = z
  .object({
    mon: dayHours.optional(),
    tue: dayHours.optional(),
    wed: dayHours.optional(),
    thu: dayHours.optional(),
    fri: dayHours.optional(),
    sat: dayHours.optional(),
    sun: dayHours.optional(),
  })
  .default({});

const faqItem = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
});

/** Optional free text (accepts null from the editor). */
const optText = z.string().max(2000).nullish();
/**
 * Allowed URL forms: http(s), mailto:, tel:, or a site-relative path ("/...", not "//host").
 * Anything else (javascript:, data:, vbscript:, ...) is rejected. Leading whitespace and
 * control characters are ignored before checking the scheme (browsers strip them too).
 */
export function isSafeUrl(value: string): boolean {
  // Browsers ignore leading C0 controls/whitespace (and NBSP/BOM) before the scheme.
  let start = 0;
  while (start < value.length) {
    const code = value.charCodeAt(start);
    const ignorable =
      code <= 0x20 || (code >= 0x7f && code <= 0x9f) || code === 0xa0 || code === 0xfeff;
    if (!ignorable) break;
    start++;
  }
  const v = value.slice(start);
  if (v === '') return true;
  // Site-relative path only: reject protocol-relative "//host" and "/\host".
  if (v.startsWith('/')) return v[1] !== '/' && v.charCodeAt(1) !== 0x5c;
  // Browsers also drop tabs/newlines inside the scheme ("java\tscript:").
  const compact = v.replace(/[\t\n\r]/g, '');
  const match = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(compact);
  if (!match) return false;
  return ['http', 'https', 'mailto', 'tel'].includes(match[1].toLowerCase());
}

/**
 * Legacy-friendly normalization: a bare domain without scheme ("wa.me/55...",
 * "instagram.com/x", "www.loja.com.br", "host.com:8080/x") gets "https://" prefixed.
 * Anything with a scheme, starting with "/", containing whitespace/control chars or
 * not looking like a domain is returned untouched (and validated by `isSafeUrl`).
 */
export function normalizeUrl(value: string): string {
  const v = value.trim();
  if (v === '') return v;
  if (v.startsWith('/')) return v;
  if (/[\s\u0000-\u001f\u007f-\u009f ﻿]/.test(v)) return v;
  const looksLikeDomain = /^[^\s\/:]+\.[a-z]{2,}([\/?#:].*)?$/i.test(v);
  // "host.tld:8080/..." looks like a scheme ("host.tld:") but is host:port.
  const hostWithPort = /^[^\s\/:]+\.[a-z]{2,}:\d+([\/?#].*)?$/i.test(v);
  if (/^[a-z][a-z0-9+.-]*:/i.test(v) && !hostWithPort) return v;
  if (looksLikeDomain) return `https://${v}`;
  return v;
}

/** URL string (trimmed, ≤ 2048, empty allowed) restricted to safe schemes. */
export const safeUrl = z
  .string()
  .trim()
  .max(2048, 'URL inválida')
  .transform(normalizeUrl)
  .refine(isSafeUrl, { message: 'URL inválida' });

/** Optional URL field: uploaded image URL, wa.me, tel:, mailto: or empty while drafting. */
const optUrl = safeUrl.nullish();
/** Money is always integer cents (BRL). */
const cents = z.number().int().min(0).max(100_000_000);

/** FORMULA opening hours rows: `[{ dias, abre?, fecha?, fechado? }]`. */
const hoursRow = z
  .object({
    dias: z.string().max(120).default(''),
    abre: optText,
    fecha: optText,
    fechado: z.boolean().optional(),
  })
  .passthrough();

const imageItem = z
  .object({
    url: safeUrl,
    alt: optText,
  })
  .passthrough();

/** Gallery accepts plain URLs (legacy) or `{ url, alt }`. */
const galleryItem = z.union([safeUrl, imageItem]);

const catalogCategory = z
  .object({
    id: z.string().max(64).optional(),
    nome: z.string().max(120).default(''),
    ordem: z.number().int().optional(),
  })
  .passthrough();

const catalogItem = z
  .object({
    id: z.string().max(64).optional(),
    nome: z.string().max(200).default(''),
    descricao: optText,
    /** Price in integer cents (BRL). */
    precoCentavos: cents.nullish(),
    /** Free label when there is no fixed price ("A combinar"). */
    precoTexto: optText,
    fotoUrl: optUrl,
    alt: optText,
    categoria: optText,
    categoriaId: optText,
    tag: optText,
    rotuloBotao: optText,
    destaque: z.boolean().optional(),
    ativo: z.boolean().optional(),
  })
  .passthrough();

const linkItem = z
  .object({
    tipo: z.string().max(40).default('url'),
    titulo: z.string().max(200).default(''),
    subtitulo: optText,
    url: safeUrl.default(''),
    icone: optText,
    destaque: z.boolean().optional(),
    badge: optText,
    aoVivo: z.boolean().optional(),
  })
  .passthrough();

const testimonialItem = z
  .object({
    nome: z.string().max(120).default(''),
    texto: z.string().max(2000).default(''),
    nota: z.number().min(0).max(5).nullish(),
    fotoUrl: optUrl,
    alt: optText,
    data: optText,
  })
  .passthrough();

const socialItem = z
  .object({
    tipo: z.string().max(40),
    url: safeUrl,
  })
  .passthrough();

/** On/off switches for optional biosite modules (absent = renderer decides by data). */
const modulesSchema = z
  .object({
    catalog: z.boolean().optional(),
    gallery: z.boolean().optional(),
    pix: z.boolean().optional(),
    links: z.boolean().optional(),
    testimonials: z.boolean().optional(),
    hours: z.boolean().optional(),
    map: z.boolean().optional(),
    reviews: z.boolean().optional(),
    faq: z.boolean().optional(),
    video: z.boolean().optional(),
    promo: z.boolean().optional(),
  })
  .passthrough();

/**
 * Site content (JSON column). Every field is optional with defaults so wizard drafts
 * saved step by step and older sites stay valid. Unknown keys pass through untouched.
 */
export const siteContentSchema = z
  .object({
    businessName: z.string().max(200).optional(),
    profile: z
      .object({
        nome: z.string().optional(),
        slogan: z.string().optional(),
        descricao: optText,
        logoUrl: optUrl,
        logoAlt: optText,
        coverUrl: optUrl,
        coverAlt: optText,
        tags: z.array(z.string()).optional(),
        cidade: z.string().optional(),
        uf: z.string().optional(),
      })
      .passthrough()
      .optional(),
    contact: z
      .object({
        whatsapp: optText,
        whatsappMensagem: optText,
        telefone: optText,
        email: optText,
        instagram: optText,
        facebook: optText,
        tiktok: optText,
        youtube: optText,
        linkedin: optText,
        site: optUrl,
      })
      .passthrough()
      .optional(),
    whatsapp: z
      .object({
        numero: z.string().default(''),
        mensagem: optText,
        mensagemPadrao: optText,
        introPedido: optText,
      })
      .passthrough()
      .optional(),
    telefone: optText,
    phone: optText,
    redes: z.array(socialItem).optional(),
    address: z
      .object({
        logradouro: optText,
        numero: optText,
        complemento: optText,
        bairro: optText,
        cidade: optText,
        uf: optText,
        cep: optText,
        lat: z.number().nullish(),
        lng: z.number().nullish(),
        mapsUrl: optUrl,
        placeId: optText,
      })
      .passthrough()
      .optional(),
    mapsUrl: optUrl,
    google: z
      .object({
        placeId: optText,
        mapsUrl: optUrl,
        rating: z.number().min(0).max(5).nullish(),
        reviewCount: z.number().int().min(0).nullish(),
        nota: z.number().min(0).max(5).nullish(),
        total: z.number().int().min(0).nullish(),
      })
      .passthrough()
      .optional(),
    theme: z
      .object({
        niche: niche.optional().default('generico'),
        brandColor: hexColor.optional(),
        overrides: z.record(z.string()).optional(),
      })
      .passthrough()
      .optional()
      .default({ niche: 'generico' }),
    modules: modulesSchema.optional(),
    sections: z.array(sectionSchema).default([]),
    strip: z
      .object({
        enabled: z.boolean().default(false),
        motif: z
          .enum(['none', 'tesoura', 'pizza', 'agulha', 'coracao', 'circulos', 'estrelas'])
          .default('none'),
        speed: z
          .union([z.enum(['slow', 'normal', 'fast']), z.number().positive()])
          .default('normal'),
        direction: z.enum(['left', 'right']).default('left'),
      })
      .default({
        enabled: false,
        motif: 'none',
        speed: 'normal',
        direction: 'left',
      }),
    catalog: z
      .object({
        layout: z.enum(['grid', 'list']).default('grid'),
        enabled: z.boolean().optional(),
        /** 'catalogo' (products) or 'cardapio' (menu) — label only. */
        kind: z.enum(['catalogo', 'cardapio']).optional(),
        titulo: optText,
        categories: z.array(catalogCategory).optional(),
        items: z.array(catalogItem).optional(),
      })
      .passthrough()
      .default({ layout: 'grid' }),
    /** FORMULA product rail (legacy) — prefer `precoCentavos` over `precoTexto`. */
    products: z.array(catalogItem).optional(),
    servicos: z.array(catalogItem).optional(),
    gallery: z.array(galleryItem).optional(),
    links: z.array(linkItem).optional(),
    testimonials: z.array(testimonialItem).optional(),
    pix: z
      .object({
        enabled: z.boolean().optional(),
        key: z.string().optional().default(''),
        receiverName: z.string().optional().default(''),
        chave: z.string().optional(),
        nome: z.string().optional(),
        qrUrl: optUrl,
        cidade: optText,
      })
      .passthrough()
      .optional()
      .default({ key: '', receiverName: '' }),
    rating: z.number().min(0).max(5).nullable().default(null),
    googleReviewUrl: safeUrl.optional(),
    faq: z.array(faqItem).default([]),
    /** Weekly map `{ mon: {open, close} | null, … }` or FORMULA rows `[{ dias, abre, fecha }]`. */
    hours: z.union([hoursSchema, z.array(hoursRow)]).default({}),
    weeklyHours: hoursSchema.optional(),
    timezone: z.string().min(1).default('America/Sao_Paulo'),
  })
  .passthrough();

export type SiteContent = z.infer<typeof siteContentSchema>;

export const defaultSiteContent = (): SiteContent =>
  siteContentSchema.parse({
    theme: { niche: 'generico' },
  });

/**
 * Shallow-merges a partial draft (wizard step) over the stored content.
 * Top-level keys present in `patch` replace the stored ones; the rest is kept.
 */
export function mergeSiteContent(existing: unknown, patch: unknown): unknown {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return patch ?? base;
  }
  return { ...base, ...(patch as Record<string, unknown>) };
}
