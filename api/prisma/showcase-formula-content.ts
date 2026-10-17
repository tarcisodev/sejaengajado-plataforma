/** Rich FORMULA payload for the 4 showcase demos (seed-showcase) with real extracted images. */

export function formulaDemoForno(base: string) {
  const ends = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  return {
    theme: {
      niche: 'restaurante' as const,
      brandColor: '#c2410c',
      p1: '#451a04',
      p2: '#fca80f',
      p3: '#fac68e',
      on3: '#1b1200',
      hi: '#ffffff',
      variante: 'f3' as const,
    },
    businessName: 'Forno da Praça',
    profile: {
      nome: 'Forno da Praça',
      slogan: 'Pães artesanais, confeitaria e lanches frescos todo dia',
      logoUrl: `${base}/samples/forno/logo.webp`,
      coverUrl: `${base}/samples/forno/svc-03.jpg`,
      cidade: 'Uberaba',
      uf: 'MG',
      tags: ['padaria', 'confeitaria', 'lanche', 'café'],
    },
    whatsapp: {
      numero: '5534999990001',
      mensagem: 'Olá! Quero pedir no Forno da Praça.',
      introPedido: 'Olá! Quero fazer um pedido no Forno da Praça:',
    },
    phone: '3433334444',
    links: [
      {
        tipo: 'whatsapp' as const,
        titulo: 'Fazer pedido no WhatsApp',
        subtitulo: 'Fornadas quentinhas e encomendas',
        url: 'https://wa.me/5534999990001',
        icone: 'whatsapp',
        destaque: true,
        aoVivo: true,
      },
      {
        tipo: 'instagram' as const,
        titulo: 'Instagram @fornodapraca',
        subtitulo: 'Veja as fornadas do dia',
        url: 'https://instagram.com/fornodapraca',
      },
      {
        tipo: 'url' as const,
        titulo: 'Cardápio completo',
        url: `${base}/samples/forno.svg`,
      },
    ],
    products: [
      {
        nome: 'Pão francês artesanal (kg)',
        precoTexto: 'R$ 18,90',
        categoria: 'Pães',
        tag: 'Fornada de hora em hora',
        fotoUrl: `${base}/samples/forno/svc-01.webp`,
      },
      {
        nome: 'Croissant & folhados amanteigados',
        precoTexto: 'R$ 14,50',
        categoria: 'Confeitaria',
        tag: 'Mais pedido',
        fotoUrl: `${base}/samples/forno/svc-02.webp`,
      },
      {
        nome: 'Torta doce & bolos caseiros',
        precoTexto: 'R$ 16,00',
        categoria: 'Doces',
        fotoUrl: `${base}/samples/forno/svc-03.jpg`,
      },
      {
        nome: 'Sanduíche na chapa + café espresso',
        precoTexto: 'R$ 22,00',
        categoria: 'Combos',
        fotoUrl: `${base}/samples/forno/svc-04.jpg`,
      },
    ],
    servicos: [
      { nome: 'Pães e fornadas do dia', fotoUrl: `${base}/samples/forno/svc-01.webp` },
      { nome: 'Doces e confeitaria fina', fotoUrl: `${base}/samples/forno/svc-03.jpg` },
      { nome: 'Salgados e lanches na hora', fotoUrl: `${base}/samples/forno/svc-04.jpg` },
      { nome: 'Tábuas de frios e encomendas', fotoUrl: `${base}/samples/forno/svc-05.jpg` },
      { nome: 'Cestas e kits de café da manhã', fotoUrl: `${base}/samples/forno/svc-06.jpg` },
    ],
    gallery: [
      `${base}/samples/forno/svc-01.webp`,
      `${base}/samples/forno/svc-02.webp`,
      `${base}/samples/forno/svc-03.jpg`,
      `${base}/samples/forno/svc-04.jpg`,
      `${base}/samples/forno/svc-05.jpg`,
      `${base}/samples/forno/svc-06.jpg`,
    ],
    google: { placeId: 'ChIJdemoForno', rating: 4.9, reviewCount: 128 },
    address: { logradouro: 'Praça Rui Barbosa, 100', cidade: 'Uberaba', uf: 'MG', cep: '38010-050' },
    hours: [
      { dias: 'seg–sex', abre: '06:00', fecha: '20:00' },
      { dias: 'sáb', abre: '06:00', fecha: '14:00' },
    ],
    weeklyHours: {
      mon: { open: '06:00', close: '20:00' },
      tue: { open: '06:00', close: '20:00' },
      wed: { open: '06:00', close: '20:00' },
      thu: { open: '06:00', close: '20:00' },
      fri: { open: '06:00', close: '20:00' },
      sat: { open: '06:00', close: '14:00' },
      sun: null,
    },
    promo: {
      titulo: 'Combo café + pão na chapa',
      texto: 'De segunda a sexta até 10h',
      precoTexto: 'R$ 12,90',
      terminaEm: ends,
      cta: 'Pedir no WhatsApp',
    },
    video: { youtubeId: 'dQw4w9WgXcQ', titulo: 'Nosso forno' },
    redes: [
      { tipo: 'instagram', url: 'https://instagram.com/fornodapraca' },
      { tipo: 'facebook', url: 'https://facebook.com/fornodapraca' },
    ],
    pix: {
      chave: 'forno@demo.sejaengajado.com.br',
      nome: 'Forno da Praça',
      qrUrl: `${base}/samples/forno/img-01.webp`,
    },
    seo: {
      title: 'Forno da Praça | Padaria em Uberaba',
      description: 'Pães e lanches frescos em Uberaba — peça no WhatsApp.',
      about: 'Padaria artesanal e confeitaria no centro de Uberaba.',
      ogImageUrl: `${base}/samples/forno/logo.webp`,
    },
    strip: { enabled: true, motif: 'pizza' as const, speed: 'normal' as const, direction: 'left' as const },
    faq: [{ question: 'Fazem entrega?', answer: 'Sim, no centro de Uberaba das 07h às 19h.' }],
    timezone: 'America/Sao_Paulo',
  };
}

export function formulaDemoBarbearia(base: string) {
  const ends = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
  return {
    theme: {
      niche: 'barbearia' as const,
      brandColor: '#1e3a5f',
      p1: '#1E2433',
      p2: '#0b111e',
      p3: '#d08900',
      on3: '#ffffff',
      hi: '#ffffff',
      bgImg: `${base}/samples/barbearia/hero-fimg.jpg`,
      bgIntensidade: 0.3,
      variante: 'f7' as const,
    },
    businessName: 'Barbearia do Centro',
    profile: {
      nome: 'Barbearia do Centro',
      slogan: 'Corte degradê, barba na toalha quente e cuidado masculino',
      logoUrl: `${base}/samples/barbearia/logo.webp`,
      coverUrl: `${base}/samples/barbearia/hero-fimg.jpg`,
      cidade: 'Uberaba',
      uf: 'MG',
      tags: ['corte', 'barba', 'degradê', 'barbearia'],
    },
    whatsapp: {
      numero: '5534999990002',
      mensagem: 'Olá! Quero agendar na Barbearia do Centro.',
      introPedido: 'Olá! Quero agendar os seguintes serviços:',
    },
    phone: '3433335555',
    links: [
      {
        tipo: 'whatsapp' as const,
        titulo: 'Agendar horário no WhatsApp',
        subtitulo: 'Atendimento com hora marcada ou encaixe',
        url: 'https://wa.me/5534999990002',
        icone: 'whatsapp',
        destaque: true,
        aoVivo: true,
        badge: 'Horários hoje',
      },
      {
        tipo: 'instagram' as const,
        titulo: 'Instagram @barbeariadocentro',
        subtitulo: 'Cortes e antes/depois',
        url: 'https://instagram.com/barbeariadocentro',
      },
    ],
    products: [
      {
        nome: 'Corte masculino completo',
        precoTexto: 'R$ 45,00',
        rotuloBotao: 'Agendar',
        tag: 'Mais pedido',
        fotoUrl: `${base}/samples/barbearia/svc-01.jpg`,
      },
      {
        nome: 'Barba na toalha quente',
        precoTexto: 'R$ 35,00',
        rotuloBotao: 'Agendar',
        fotoUrl: `${base}/samples/barbearia/svc-02.webp`,
      },
      {
        nome: 'Combo Corte + Barba + Sobrancelha',
        precoTexto: 'R$ 70,00',
        rotuloBotao: 'Agendar',
        tag: 'Combo VIP',
        fotoUrl: `${base}/samples/barbearia/svc-03.jpg`,
      },
      {
        nome: 'Acabamento, pezinho e pigmentação',
        precoTexto: 'R$ 30,00',
        rotuloBotao: 'Agendar',
        fotoUrl: `${base}/samples/barbearia/svc-04.jpg`,
      },
    ],
    servicos: [
      { nome: 'Corte degradê & social', fotoUrl: `${base}/samples/barbearia/svc-01.jpg` },
      { nome: 'Barba terapia (hot towel)', fotoUrl: `${base}/samples/barbearia/svc-02.webp` },
      { nome: 'Combo Corte + Barba', fotoUrl: `${base}/samples/barbearia/svc-03.jpg` },
      { nome: 'Sobrancelha e pigmentação', fotoUrl: `${base}/samples/barbearia/svc-04.jpg` },
    ],
    gallery: [
      `${base}/samples/barbearia/svc-01.jpg`,
      `${base}/samples/barbearia/svc-02.webp`,
      `${base}/samples/barbearia/svc-03.jpg`,
      `${base}/samples/barbearia/svc-04.jpg`,
    ],
    google: { placeId: 'ChIJdemoBarb', rating: 4.9, reviewCount: 86 },
    address: { logradouro: 'Rua Minas Gerais, 250', cidade: 'Uberaba', uf: 'MG' },
    hours: [{ dias: 'ter–sáb', abre: '09:00', fecha: '19:00' }],
    weeklyHours: {
      mon: null,
      tue: { open: '09:00', close: '19:00' },
      wed: { open: '09:00', close: '19:00' },
      thu: { open: '09:00', close: '19:00' },
      fri: { open: '09:00', close: '19:00' },
      sat: { open: '09:00', close: '19:00' },
      sun: null,
    },
    promo: {
      titulo: 'Primeira visita',
      texto: '15% OFF no combo Corte + Barba agendando pelo site',
      precoTexto: 'R$ 59,90',
      terminaEm: ends,
      cta: 'Reservar com desconto',
    },
    video: { youtubeId: 'jNQXAC9IVRw', titulo: 'Ambiente' },
    redes: [{ tipo: 'instagram', url: 'https://instagram.com/barbeariadocentro' }],
    pix: {
      chave: 'barbearia@demo.sejaengajado.com.br',
      nome: 'Barbearia do Centro',
      qrUrl: `${base}/samples/barbearia/img-01.webp`,
    },
    seo: {
      title: 'Barbearia do Centro | Corte e barba em Uberaba',
      description: 'Barbearia no centro de Uberaba — agende no WhatsApp.',
      about: 'Cortes clássicos e modernos com atendimento rápido e cerveja gelada.',
      ogImageUrl: `${base}/samples/barbearia/logo.webp`,
    },
    strip: { enabled: true, motif: 'tesoura' as const, speed: 'slow' as const, direction: 'left' as const },
    faq: [
      {
        question: 'Aceitam encaixe?',
        answer: 'Sim, conforme agenda do dia. Prefira agendar pelo WhatsApp.',
      },
    ],
    timezone: 'America/Sao_Paulo',
  };
}

export function formulaDemoEstudio(base: string) {
  return {
    theme: {
      niche: 'generico' as const,
      brandColor: '#0f766e',
      bgImg: `${base}/samples/estudio/hero-fimg.webp`,
      bgIntensidade: 0.25,
      variante: 'f3' as const,
    },
    businessName: 'Estúdio Luz Local',
    profile: {
      nome: 'Estúdio Luz Local',
      slogan: 'Fotos, retratos corporativos e conteúdo visual para o seu negócio',
      logoUrl: `${base}/samples/estudio/logo.webp`,
      coverUrl: `${base}/samples/estudio/hero-fimg.webp`,
      cidade: 'Uberaba',
      uf: 'MG',
      tags: ['fotografia', 'estúdio', 'retratos', 'marcas'],
    },
    whatsapp: {
      numero: '5534999990003',
      mensagem: 'Olá! Quero orçamento no Estúdio Luz.',
      introPedido: 'Olá! Quero orçamento para:',
    },
    phone: '3433336666',
    links: [
      {
        tipo: 'whatsapp' as const,
        titulo: 'Pedir orçamento no WhatsApp',
        subtitulo: 'Ensaios corporativos, produtos e gastronomia',
        url: 'https://wa.me/5534999990003',
        icone: 'whatsapp',
        destaque: true,
        aoVivo: true,
      },
      { tipo: 'url' as const, titulo: 'Portfólio completo', url: `${base}/samples/estudio.svg` },
      { tipo: 'instagram' as const, titulo: 'Instagram @estudioluz', url: 'https://instagram.com/estudioluz' },
    ],
    products: [
      {
        nome: 'Ensaio produto / catálogo (10 fotos)',
        precoTexto: 'R$ 350,00',
        rotuloBotao: 'Solicitar',
        tag: 'Entrega em 48h',
        fotoUrl: `${base}/samples/estudio/svc-01.jpg`,
      },
      {
        nome: 'Retrato profissional & posicionamento',
        precoTexto: 'R$ 420,00',
        rotuloBotao: 'Solicitar',
        fotoUrl: `${base}/samples/estudio/svc-02.webp`,
      },
      {
        nome: 'Fachada + equipe no local',
        precoTexto: 'R$ 480,00',
        rotuloBotao: 'Solicitar',
        fotoUrl: `${base}/samples/estudio/svc-03.webp`,
      },
    ],
    servicos: [
      { nome: 'Ensaio de produto e cardápio', fotoUrl: `${base}/samples/estudio/svc-01.jpg` },
      { nome: 'Retrato corporativo em estúdio', fotoUrl: `${base}/samples/estudio/svc-02.webp` },
      { nome: 'Fotos de equipe e ambiente', fotoUrl: `${base}/samples/estudio/svc-03.webp` },
    ],
    gallery: [
      `${base}/samples/estudio/svc-01.jpg`,
      `${base}/samples/estudio/svc-02.webp`,
      `${base}/samples/estudio/svc-03.webp`,
    ],
    google: { placeId: 'ChIJdemoEstudio', rating: 4.8, reviewCount: 42 },
    address: { logradouro: 'Av. Leopoldino de Oliveira, 800', cidade: 'Uberaba', uf: 'MG' },
    hours: [{ dias: 'seg–sex', abre: '09:00', fecha: '18:00' }],
    weeklyHours: {
      mon: { open: '09:00', close: '18:00' },
      tue: { open: '09:00', close: '18:00' },
      wed: { open: '09:00', close: '18:00' },
      thu: { open: '09:00', close: '18:00' },
      fri: { open: '09:00', close: '18:00' },
      sat: null,
      sun: null,
    },
    video: { youtubeId: 'M7lc1UVf-VE', titulo: 'Bastidores' },
    redes: [
      { tipo: 'instagram', url: 'https://instagram.com/estudioluz' },
      { tipo: 'youtube', url: 'https://youtube.com/@estudioluz' },
    ],
    pix: {
      chave: 'estudio@demo.sejaengajado.com.br',
      nome: 'Estúdio Luz Local',
      qrUrl: `${base}/samples/estudio/img-01.webp`,
    },
    seo: {
      title: 'Estúdio Luz Local | Fotografia em Uberaba',
      description: 'Fotos para negócios locais e profissionais em Uberaba.',
      about: 'Estúdio focado em marcas locais, profissionais liberais e redes sociais.',
      ogImageUrl: `${base}/samples/estudio/logo.webp`,
    },
    strip: { enabled: false, motif: 'none' as const, speed: 'normal' as const, direction: 'left' as const },
    faq: [
      {
        question: 'Atendem empresas no local?',
        answer: 'Sim — levamos iluminação móvel para fotos de equipe, consultório e fachada.',
      },
    ],
    timezone: 'America/Sao_Paulo',
  };
}

export function formulaDemoClinica(base: string) {
  return {
    theme: {
      niche: 'saude' as const,
      brandColor: '#0f5c4c',
      p1: '#0f5c4c',
      p2: '#2a8f7a',
      p3: '#cfe6e0',
      on3: '#10241f',
      hi: '#f2f8f7',
      bgImg: `${base}/samples/clinica/hero-fimg.jpg`,
      bgIntensidade: 0.28,
      variante: 'f7' as const,
    },
    businessName: 'Clínica Serenidade — Psicologia & Terapia',
    profile: {
      nome: 'Clínica Serenidade — Psicologia & Terapia',
      slogan: 'Psicoterapia, acolhimento ético (CRP) e saúde emocional — presencial e online',
      logoUrl: `${base}/samples/clinica/logo.webp`,
      coverUrl: `${base}/samples/clinica/hero-fimg.jpg`,
      cidade: 'Uberaba',
      uf: 'MG',
      tags: ['psicologia', 'terapia', 'clínica', 'ansiedade', 'saúde mental'],
    },
    whatsapp: {
      numero: '5534999990004',
      mensagem: 'Olá! Gostaria de agendar uma sessão na Clínica Serenidade.',
      introPedido: 'Olá! Tenho interesse nos seguintes atendimentos:',
    },
    phone: '3433337777',
    links: [
      {
        tipo: 'whatsapp' as const,
        titulo: 'Agendar primeira sessão',
        subtitulo: 'Atendimento presencial e online com sigilo ético (CRP)',
        url: 'https://wa.me/5534999990004',
        icone: 'whatsapp',
        destaque: true,
        aoVivo: true,
        badge: 'Agenda aberta',
      },
      {
        tipo: 'instagram' as const,
        titulo: 'Instagram @clinicaserenidade',
        subtitulo: 'Conteúdos sobre saúde mental e autocuidado',
        url: 'https://instagram.com/clinicaserenidade',
      },
    ],
    products: [
      {
        nome: 'Psicoterapia individual (50 min)',
        precoTexto: 'Valores a combinar',
        rotuloBotao: 'Agendar sessão',
        tag: 'Presencial ou Online',
        categoria: 'Psicoterapia',
        fotoUrl: `${base}/samples/clinica/svc-01.jpg`,
      },
      {
        nome: 'Terapia de casal & relacionamento',
        precoTexto: 'Valores a combinar',
        rotuloBotao: 'Agendar conversa',
        tag: 'Sessão de 60 min',
        categoria: 'Casal & Família',
        fotoUrl: `${base}/samples/clinica/svc-02.jpg`,
      },
      {
        nome: 'Ansiedade, estresse e burnout',
        precoTexto: 'Acompanhamento semanal',
        rotuloBotao: 'Quero saber mais',
        tag: 'Terapia Cognitivo-Comportamental',
        categoria: 'Especialidades',
        fotoUrl: `${base}/samples/clinica/svc-03.jpg`,
      },
      {
        nome: 'Atendimento psicológico online',
        precoTexto: 'Vídeo com sigilo CRP',
        rotuloBotao: 'Consultar horários',
        tag: 'Em todo o Brasil e exterior',
        categoria: 'Online',
        fotoUrl: `${base}/samples/clinica/svc-04.jpg`,
      },
    ],
    servicos: [
      {
        nome: 'Psicoterapia individual (adultos e adolescentes)',
        fotoUrl: `${base}/samples/clinica/svc-01.jpg`,
      },
      {
        nome: 'Terapia de casal e conflitos familiares',
        fotoUrl: `${base}/samples/clinica/svc-02.jpg`,
      },
      {
        nome: 'Ansiedade, estresse e regulação emocional',
        fotoUrl: `${base}/samples/clinica/svc-03.jpg`,
      },
      {
        nome: 'Sessão online por videochamada segura',
        fotoUrl: `${base}/samples/clinica/svc-04.jpg`,
      },
    ],
    gallery: [
      `${base}/samples/clinica/svc-01.jpg`,
      `${base}/samples/clinica/svc-02.jpg`,
      `${base}/samples/clinica/svc-03.jpg`,
      `${base}/samples/clinica/svc-04.jpg`,
    ],
    google: { placeId: 'ChIJdemoClinica', rating: 5.0, reviewCount: 64 },
    address: {
      logradouro: 'Rua Santos Dumont, 420 — Sala 302',
      cidade: 'Uberaba',
      uf: 'MG',
      cep: '38010-370',
    },
    hours: [
      { dias: 'seg–sex', abre: '08:00', fecha: '20:00' },
      { dias: 'sáb', abre: '08:00', fecha: '12:00' },
    ],
    weeklyHours: {
      mon: { open: '08:00', close: '20:00' },
      tue: { open: '08:00', close: '20:00' },
      wed: { open: '08:00', close: '20:00' },
      thu: { open: '08:00', close: '20:00' },
      fri: { open: '08:00', close: '20:00' },
      sat: { open: '08:00', close: '12:00' },
      sun: null,
    },
    redes: [{ tipo: 'instagram', url: 'https://instagram.com/clinicaserenidade' }],
    pix: {
      chave: 'clinica@demo.sejaengajado.com.br',
      nome: 'Clínica Serenidade Psicologia',
      qrUrl: `${base}/samples/clinica/dra-01.webp`,
    },
    seo: {
      title: 'Clínica Serenidade | Psicologia e Terapia em Uberaba',
      description:
        'Psicoterapia individual, terapia de casal e atendimento online em Uberaba — agende pelo WhatsApp.',
      about:
        'Consultório e clínica de psicologia com foco em escuta ética (CRP), acolhimento humanizado e saúde emocional.',
      ogImageUrl: `${base}/samples/clinica/logo.webp`,
    },
    strip: { enabled: false, motif: 'none' as const, speed: 'slow' as const, direction: 'left' as const },
    faq: [
      {
        question: 'Como funciona a primeira sessão?',
        answer:
          'É um momento de acolhimento e escuta inicial para compreender sua demanda, explicar o processo terapêutico e combinar frequência e horários.',
      },
      {
        question: 'Atendem online por videochamada?',
        answer:
          'Sim, atendemos adultos e adolescentes online com total sigilo profissional conforme normas do Conselho Federal de Psicologia (CFP/CRP).',
      },
      {
        question: 'Emitem recibo para reembolso no plano de saúde?',
        answer:
          'Sim, emitimos recibo/nota fiscal para reembolso no convênio e dedução no Imposto de Renda.',
      },
    ],
    timezone: 'America/Sao_Paulo',
  };
}
