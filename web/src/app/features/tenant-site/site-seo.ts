import { SiteContent, SiteHours } from '../../core/models/domain';

export interface ClockParts {
  d: string;
  h: string;
  m: string;
  s: string;
}

export function displayName(content: SiteContent): string {
  return content.profile.nome || content.businessName;
}

export function siteCanonical(slug: string): string {
  return `https://${slug}.sejaengajado.com.br/`;
}

export function siteTitle(content: SiteContent): string {
  if (content.seo?.title) {
    return content.seo.title;
  }
  return `${displayName(content)} em ${content.profile.cidade}`;
}

export function siteDescription(content: SiteContent): string {
  if (content.seo?.description) {
    return content.seo.description;
  }
  const slogan = content.profile.slogan ? `${content.profile.slogan}. ` : '';
  return `${slogan}${displayName(content)} em ${content.profile.cidade}. Chame no WhatsApp.`;
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
  return `Procurando ${displayName(content)} em ${content.profile.cidade}? O endereço do negócio está aqui, com WhatsApp e avaliação no Google.${list}`;
}

export function ogImageUrl(content: SiteContent): string {
  return content.seo?.ogImageUrl ?? 'https://sejaengajado.com.br/og.svg';
}

export function whatsappHref(numero: string, text: string): string {
  const digits = numero.replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function addressLine(content: SiteContent): string {
  const address = content.address;
  if (!address) {
    return '';
  }
  return `${address.logradouro}, ${address.cidade} - ${address.uf}`;
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
  const sameAs = (content.links ?? [])
    .filter((link) => link.tipo === 'instagram')
    .map((link) => link.url);
  const business: Record<string, unknown> = {
    '@type': schemaType,
    name: displayName(content),
    url,
    description: siteDescription(content),
    image: ogImageUrl(content),
    address: {
      '@type': 'PostalAddress',
      addressLocality: content.profile.cidade,
      addressRegion: content.profile.uf,
      addressCountry: 'BR',
      ...(content.address ? { streetAddress: content.address.logradouro } : {}),
    },
  };
  if (content.phone) {
    business['telephone'] = content.phone;
  }
  if (content.address) {
    business['hasMap'] = mapsLink(content);
  }
  if (sameAs.length) {
    business['sameAs'] = sameAs;
  }
  if (content.products?.length) {
    business['makesOffer'] = content.products.map((item) => ({
      '@type': 'Offer',
      name: item.nome,
      description: item.precoTexto,
    }));
  }
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
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
    ],
  });
}
