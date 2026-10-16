import { SiteContent, SiteTheme } from '../core/models/domain';

const HEADING_SHOP = 'Fraunces, Palatino, serif';
const HEADING_MENU = 'Newsreader, Palatino, serif';
const BODY = 'Literata, Georgia, serif';

const THEME_BARBER: SiteTheme = {
  p1: '#161410',
  p2: '#8c3a2f',
  p3: '#e6d3a3',
  on3: '#161410',
  hi: '#f6f1e7',
  fontHeading: HEADING_SHOP,
  fontBody: BODY,
  fontScale: 1,
  italic: 'normal',
};

const THEME_KITCHEN: SiteTheme = {
  p1: '#8c3a2f',
  p2: '#c47a2c',
  p3: '#f3e6c8',
  on3: '#2a120c',
  hi: '#fff8ef',
  fontHeading: HEADING_MENU,
  fontBody: BODY,
  fontScale: 1.02,
  italic: 'italic',
};

const THEME_CUSTOM: SiteTheme = {
  p1: '#2c2825',
  p2: '#6b6258',
  p3: '#efe6d8',
  on3: '#2c2825',
  hi: '#f7f3ec',
  fontHeading: HEADING_SHOP,
  fontBody: BODY,
  fontScale: 1,
  italic: 'normal',
};

const THEME_SERVICE: SiteTheme = {
  p1: '#1e3a5f',
  p2: '#3d5a4c',
  p3: '#d5e2dc',
  on3: '#102018',
  hi: '#f4f7f6',
  fontHeading: HEADING_SHOP,
  fontBody: BODY,
  fontScale: 0.96,
  italic: 'normal',
};

export function themeForTemplate(templateId: string): SiteTheme {
  return { ...themeFor(templateId) };
}

function themeFor(templateId: string): SiteTheme {
  if (templateId === 'tpl_restaurante') {
    return THEME_KITCHEN;
  }
  if (templateId === 'tpl_servicos') {
    return THEME_SERVICE;
  }
  if (templateId === 'tpl_personalizado') {
    return THEME_CUSTOM;
  }
  return THEME_BARBER;
}

function plain(businessName: string, templateId: string): SiteContent {
  return {
    businessName,
    profile: {
      nome: businessName,
      cidade: 'Uberaba',
      uf: 'MG',
    },
    theme: themeFor(templateId),
  };
}

export function contentForSite(
  slug: string,
  businessName: string,
  templateId: string,
): SiteContent {
  return BIOS[slug] ?? plain(businessName, templateId);
}

const BIOS: Record<string, SiteContent> = {
  'barbearia-do-ze': {
    businessName: 'Barbearia do Zé',
    profile: {
      nome: 'Barbearia do Zé',
      slogan: 'Corte e barba no centro de Uberaba',
      tags: ['corte', 'barba', 'centro'],
      cidade: 'Uberaba',
      uf: 'MG',
    },
    theme: THEME_BARBER,
    whatsapp: {
      numero: '5534999990001',
      mensagem: 'Olá, quero horário na Barbearia do Zé.',
    },
    links: [
      { tipo: 'instagram', titulo: 'Instagram', url: 'https://instagram.com/barbeariadoze' },
      { tipo: 'tel', titulo: 'Ligar', url: 'tel:+5534999990001' },
    ],
    hours: [
      { dias: 'seg', fechado: true },
      { dias: 'ter a sáb', abre: '09:00', fecha: '19:00' },
    ],
    gallery: ['/samples/barbearia.svg'],
    products: [
      { nome: 'Corte', precoTexto: 'R$ 40,00', fotoUrl: '/samples/barbearia.svg' },
      { nome: 'Barba', precoTexto: 'R$ 30,00', fotoUrl: '/samples/barbearia.svg' },
    ],
    promo: {
      titulo: 'Corte e barba',
      texto: 'Os dois no mesmo horário, nesta semana.',
      terminaEm: '2027-06-01T23:59:00-03:00',
    },
    google: { placeId: 'ChIJZeUberabaMock' },
    address: {
      logradouro: 'Rua da Praça, 120, Centro',
      cidade: 'Uberaba',
      uf: 'MG',
    },
    phone: '+5534999990001',
    seo: {
      title: 'Barbearia do Zé | Corte em Uberaba',
      description: 'Corte e barba no centro de Uberaba. Chame no WhatsApp.',
      ogImageUrl: 'https://sejaengajado.com.br/og.svg',
    },
  },
  'pizzaria-forno-da-praca': {
    businessName: 'Pizzaria Forno da Praça',
    profile: {
      nome: 'Pizzaria Forno da Praça',
      slogan: 'Forno a lenha na praça',
      tags: ['pizza', 'forno', 'praça'],
      cidade: 'Uberaba',
      uf: 'MG',
    },
    theme: THEME_KITCHEN,
    whatsapp: {
      numero: '5534999990002',
      mensagem: 'Olá, quero pedir no Forno da Praça.',
    },
    links: [
      { tipo: 'instagram', titulo: 'Instagram', url: 'https://instagram.com/fornodapraca' },
      {
        tipo: 'maps',
        titulo: 'Como chegar',
        url: 'https://www.google.com/maps?q=Pra%C3%A7a+Rui+Barbosa+Uberaba',
      },
    ],
    hours: [{ dias: 'ter a dom', abre: '18:00', fecha: '23:00' }],
    gallery: ['/samples/forno.svg'],
    products: [
      { nome: 'Margherita', precoTexto: 'R$ 48,00', fotoUrl: '/samples/forno.svg' },
      { nome: 'Calabresa', precoTexto: 'R$ 52,00', fotoUrl: '/samples/forno.svg' },
    ],
    promo: {
      titulo: 'Borda recheada',
      texto: 'Na pizza grande, até o fim do mês.',
      terminaEm: '2027-06-30T23:59:00-03:00',
    },
    google: { placeId: 'ChIJFornoUberabaMock' },
    address: {
      logradouro: 'Praça Rui Barbosa, 40',
      cidade: 'Uberaba',
      uf: 'MG',
    },
    phone: '+5534999990002',
    pix: { chave: 'forno@example.com', nome: 'Pizzaria Forno da Praça' },
    seo: {
      title: 'Pizzaria Forno da Praça | Pizza em Uberaba',
      description: 'Forno a lenha na praça de Uberaba. Chame no WhatsApp.',
      ogImageUrl: 'https://sejaengajado.com.br/og.svg',
    },
  },
  'estudio-linha-verde': {
    businessName: 'Estúdio Linha Verde',
    profile: {
      nome: 'Estúdio Linha Verde',
      slogan: 'Projeto e obra residencial',
      tags: ['arquitetura', 'obra'],
      cidade: 'Uberaba',
      uf: 'MG',
      logoUrl: '/samples/estudio.svg',
    },
    theme: THEME_SERVICE,
    whatsapp: {
      numero: '5534999990008',
      mensagem: 'Olá, quero falar com o Estúdio Linha Verde.',
    },
    links: [
      { tipo: 'instagram', titulo: 'Instagram', url: 'https://instagram.com/estudiolinhaverde' },
      { tipo: 'tel', titulo: 'Ligar', url: 'tel:+5534999990008' },
    ],
    hours: [
      { dias: 'seg a sex', abre: '08:00', fecha: '18:00' },
      { dias: 'sáb e dom', fechado: true },
    ],
    google: { placeId: 'ChIJEstudioUberabaMock' },
    address: {
      logradouro: 'Avenida Leopoldino de Oliveira, 800',
      cidade: 'Uberaba',
      uf: 'MG',
    },
    phone: '+5534999990008',
    pix: {
      chave: '34999990008',
      nome: 'Estúdio Linha Verde',
      qrUrl: '/og.svg',
    },
    seo: {
      title: 'Estúdio Linha Verde | Arquitetura em Uberaba',
      description: 'Projeto e obra residencial em Uberaba. Chame no WhatsApp.',
      about: 'Procurando arquitetura em Uberaba? O Estúdio Linha Verde atende projeto e obra.',
      ogImageUrl: 'https://sejaengajado.com.br/og.svg',
    },
  },
};
