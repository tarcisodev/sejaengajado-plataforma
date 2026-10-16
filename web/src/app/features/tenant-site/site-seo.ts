import { SiteContent, SiteHours, SiteWeeklyHours, WeekdayKey } from '../../core/models/domain';
import type { NicheThemeKey } from '../../core/theme/niche-themes';
import { resolveNicheKey } from '../../core/theme/niche-themes';
import {
  galleryImages,
  productCents,
  productPriceLabel,
  weeklyHoursOf,
} from '../../core/site/site-content';

export interface ClockParts {
  d: string;
  h: string;
  m: string;
  s: string;
}

const NICHE_SCHEMA: Record<NicheThemeKey, string> = {
  barbearia: 'BarberShop',
  restaurante: 'Restaurant',
  moda: 'ClothingStore',
  beleza: 'BeautySalon',
  saude: 'MedicalBusiness',
  generico: 'LocalBusiness',
};

const WEEKDAY_SCHEMA: Record<WeekdayKey, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

/** Prefer template schemaType; fall back to niche mapping. */
export function schemaTypeForContent(content: SiteContent, templateSchema?: string | null): string {
  if (templateSchema && templateSchema !== 'LocalBusiness') {
    return templateSchema;
  }
  return NICHE_SCHEMA[resolveNicheKey(content.theme?.niche)];
}

export function openingHoursSpecification(
  weekly: SiteWeeklyHours | undefined,
): Record<string, unknown>[] {
  if (!weekly) {
    return [];
  }
  const specs: Record<string, unknown>[] = [];
  for (const day of Object.keys(WEEKDAY_SCHEMA) as WeekdayKey[]) {
    const slot = weekly[day];
    if (slot?.open && slot.close) {
      specs.push({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: WEEKDAY_SCHEMA[day],
        opens: slot.open,
        closes: slot.close,
      });
    }
  }
  return specs;
}

export function displayName(content: SiteContent): string {
  return content.profile?.nome || content.businessName || 'Negócio';
}

export function siteCanonical(slug: string): string {
  return `https://${slug}.sejaengajado.com.br/`;
}

export function siteTitle(content: SiteContent): string {
  if (content.seo?.title) {
    return content.seo.title;
  }
  const city = content.profile?.cidade?.trim();
  const service =
    content.servicos?.[0]?.nome || content.products?.[0]?.nome || content.profile?.tags?.[0] || '';
  if (city && service) {
    return `${displayName(content)} | ${service} em ${city}`;
  }
  return city ? `${displayName(content)} em ${city}` : displayName(content);
}

export function siteDescription(content: SiteContent): string {
  if (content.seo?.description) {
    return content.seo.description;
  }
  const slogan = content.profile?.slogan ? `${content.profile.slogan}. ` : '';
  const city = content.profile?.cidade?.trim();
  const where = city ? ` em ${city}` : '';
  return `${slogan}${displayName(content)}${where}. Chame no WhatsApp.`;
}

export function aboutText(content: SiteContent): string {
  if (content.seo?.about) {
    return content.seo.about;
  }
  const offered = (content.products ?? [])
    .map((item) => item.nome)
    .slice(0, 4)
    .join(', ');
  const list = offered ? ` Entre o que oferece: ${offered}.` : '';
  const city = content.profile?.cidade?.trim();
  const where = city ? ` em ${city}` : '';
  return `Procurando ${displayName(content)}${where}? O endereço do negócio está aqui, com WhatsApp e avaliação no Google.${list}`;
}

export function ogImageUrl(content: SiteContent): string {
  const fromSeo = content.seo?.ogImageUrl?.trim();
  if (fromSeo) {
    return fromSeo;
  }
  const isHttp = (value: string | undefined): value is string => !!value && /^https?:\/\//.test(value);
  const cover = content.profile?.coverUrl?.trim();
  if (isHttp(cover)) {
    return cover;
  }
  const logo = content.profile?.logoUrl?.trim();
  if (isHttp(logo)) {
    return logo;
  }
  const gallery = galleryImages(content)[0]?.url;
  if (isHttp(gallery)) {
    return gallery;
  }
  return 'https://sejaengajado.com.br/og.svg';
}

export function whatsappHref(numero: string, text: string): string {
  const digits = numero.replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function addressLine(content: SiteContent): string {
  const address = content.address;
  if (!address?.logradouro) {
    return '';
  }
  const city = [address.cidade, address.uf].filter(Boolean).join(' - ');
  const street = [address.logradouro, address.numero, address.complemento]
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join(', ');
  const parts = [street, address.bairro, city].filter((part) => part && part.trim());
  const line = parts.join(', ');
  return address.cep ? `${line}, ${address.cep}` : line;
}

export function mapsEmbed(content: SiteContent): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(addressLine(content))}&output=embed`;
}

export function mapsLink(content: SiteContent): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(addressLine(content))}`;
}

export function hourLine(row: SiteHours): string {
  if (row.fechado || !row.abre || !row.fecha) {
    return `${row.dias}: Fechado`;
  }
  return `${row.dias}: ${row.abre}–${row.fecha}`;
}

export function initials(nome: string): string {
  return nome
    .split(/\s+/)
    .filter((part) => part && part !== 'da' && part !== 'do' && part !== 'de')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function countdownParts(endIso: string, now = new Date()): ClockParts | null {
  const end = new Date(endIso).getTime();
  const diff = end - now.getTime();
  if (Number.isNaN(end) || diff <= 0) {
    return null;
  }
  const total = Math.floor(diff / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return { d: String(days), h: pad(hours), m: pad(minutes), s: pad(seconds) };
}

export function siteJsonLd(content: SiteContent, slug: string, schemaType: string): string {
  const url = siteCanonical(slug);
  const resolvedType = schemaTypeForContent(content, schemaType);
  const sameAs = [
    ...(content.links ?? []).filter((link) => link.tipo === 'instagram').map((link) => link.url),
    ...(content.redes ?? []).filter((rede) => !!rede?.url).map((rede) => rede.url),
  ];
  const business: Record<string, unknown> = {
    '@type': resolvedType,
    name: displayName(content),
    url,
    description: siteDescription(content),
    image: ogImageUrl(content),
    address: {
      '@type': 'PostalAddress',
      addressLocality: content.profile.cidade,
      addressRegion: content.profile.uf,
      addressCountry: 'BR',
      ...(content.address?.logradouro ? { streetAddress: content.address.logradouro } : {}),
      ...(content.address?.cep ? { postalCode: content.address.cep } : {}),
    },
  };
  if (content.phone) {
    business['telephone'] = content.phone;
  }
  if (content.email) {
    business['email'] = content.email;
  }
  if (content.mapsUrl) {
    business['hasMap'] = content.mapsUrl;
  } else if (content.address?.logradouro) {
    business['hasMap'] = mapsLink(content);
  }
  if (sameAs.length) {
    business['sameAs'] = sameAs;
  }
  const hours = openingHoursSpecification(weeklyHoursOf(content));
  if (hours.length) {
    business['openingHoursSpecification'] = hours;
  }
  const rating = content.google?.rating;
  const reviewCount = content.google?.reviewCount;
  if (typeof rating === 'number' && Number.isFinite(rating) && typeof reviewCount === 'number') {
    business['aggregateRating'] = {
      '@type': 'AggregateRating',
      ratingValue: rating,
      reviewCount,
    };
  }
  if (content.products?.length) {
    business['makesOffer'] = content.products.map((item) => {
      const cents = productCents(item);
      return {
        '@type': 'Offer',
        name: item.nome,
        description: productPriceLabel(item) || undefined,
        ...(cents !== null ? { price: (cents / 100).toFixed(2), priceCurrency: 'BRL' } : {}),
      };
    });
  }
  const graph: Record<string, unknown>[] = [
    business,
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: `${content.profile.cidade}-${content.profile.uf}`,
          item: 'https://sejaengajado.com.br/',
        },
        { '@type': 'ListItem', position: 2, name: displayName(content), item: url },
      ],
    },
  ];
  if (content.faq?.length) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: content.faq.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    });
  }
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': graph,
  });
}
