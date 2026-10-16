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

export const siteContentSchema = z.object({
  theme: z.object({
    niche,
    brandColor: hexColor.optional(),
    overrides: z.record(z.string()).optional(),
  }),
  sections: z.array(sectionSchema).default([]),
  strip: z
    .object({
      enabled: z.boolean().default(false),
      motif: z
        .enum(['none', 'tesoura', 'pizza', 'agulha', 'coracao', 'circulos', 'estrelas'])
        .default('none'),
      speed: z.enum(['slow', 'normal', 'fast']).default('normal'),
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
    })
    .default({ layout: 'grid' }),
  pix: z
    .object({
      key: z.string().default(''),
      receiverName: z.string().default(''),
    })
    .default({ key: '', receiverName: '' }),
  rating: z.number().min(0).max(5).nullable().default(null),
  googleReviewUrl: z.union([z.string().url(), z.literal('')]).optional(),
  faq: z.array(faqItem).default([]),
  hours: hoursSchema,
  timezone: z.string().min(1).default('America/Sao_Paulo'),
});

export type SiteContent = z.infer<typeof siteContentSchema>;

export const defaultSiteContent = (): SiteContent =>
  siteContentSchema.parse({
    theme: { niche: 'generico' },
  });
