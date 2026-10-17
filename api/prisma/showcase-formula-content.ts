/** Rich FORMULA payload for the 3 showcase demos (seed-showcase). */

export function formulaDemoForno(base: string) {
  const ends = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  return {
    theme: { niche: 'restaurante' as const, brandColor: '#c2410c' },
    businessName: 'Forno da Praça',
    profile: {
      nome: 'Forno da Praça',
      slogan: 'Pães e lanches frescos todo dia',
      logoUrl: `${base}/samples/forno.svg`,
      cidade: 'Uberaba',
      uf: 'MG',
      tags: ['padaria', 'lanche', 'café'],
    },
    whatsapp: { numero: '5534999990001', mensagem: 'Olá! Quero pedir no Forno da Praça.' },
    phone: '3433334444',
    links: [
      {
        tipo: 'instagram' as const,
        titulo: 'Instagram',
        url: 'https://instagram.com/fornodapraca',
      },
      { tipo: 'url' as const, titulo: 'Cardápio PDF', url: `${base}/samples/forno.svg` },
    ],
    products: [
      { nome: 'Pão francês (kg)', precoTexto: 'R$ 18,90', categoria: 'Pães' },
      { nome: 'Misto quente', precoTexto: 'R$ 12,00', categoria: 'Lanches' },
      { nome: 'Café com leite', precoTexto: 'R$ 6,50', categoria: 'Bebidas' },
    ],
    servicos: [{ nome: 'Encomenda de festa' }, { nome: 'Café da manhã corporativo' }],
    google: { placeId: 'ChIJdemoForno', rating: 4.7, reviewCount: 128 },
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
      titulo: 'Combo café + pão',
      texto: 'De segunda a sexta até 10h',
      terminaEm: ends,
      cta: 'Pedir no WhatsApp',
    },
    video: { youtubeId: 'dQw4w9WgXcQ', titulo: 'Nosso forno' },
    redes: [
      { tipo: 'instagram', url: 'https://instagram.com/fornodapraca' },
      { tipo: 'facebook', url: 'https://facebook.com/fornodapraca' },
    ],
    pix: { chave: 'forno@demo.sejaengajado.com.br', nome: 'Forno da Praça' },
    seo: {
      title: 'Forno da Praça | Padaria em Uberaba',
      description: 'Pães e lanches frescos em Uberaba — peça no WhatsApp.',
      about: 'Padaria artesanal no centro de Uberaba.',
      ogImageUrl: `${base}/samples/forno.svg`,
    },
    strip: { enabled: true, motif: 'pizza' as const, speed: 'normal' as const, direction: 'left' as const },
    faq: [{ question: 'Fazem entrega?', answer: 'Sim, no centro de Uberaba das 10h às 20h.' }],
    timezone: 'America/Sao_Paulo',
  };
}

export function formulaDemoBarbearia(base: string) {
  const ends = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
  return {
    theme: { niche: 'barbearia' as const, brandColor: '#1e3a5f' },
    businessName: 'Barbearia do Centro',
    profile: {
      nome: 'Barbearia do Centro',
      slogan: 'Corte, barba e cuidado masculino',
      logoUrl: `${base}/samples/barbearia.svg`,
      cidade: 'Uberaba',
      uf: 'MG',
      tags: ['corte', 'barba', 'barbearia'],
    },
    whatsapp: { numero: '5534999990002', mensagem: 'Olá! Quero agendar na Barbearia do Centro.' },
    phone: '3433335555',
    links: [
      { tipo: 'whatsapp' as const, titulo: 'Agendar', url: 'https://wa.me/5534999990002' },
      {
        tipo: 'instagram' as const,
        titulo: 'Instagram',
        url: 'https://instagram.com/barbeariadocentro',
      },
    ],
    products: [
      { nome: 'Corte masculino', precoTexto: 'R$ 45,00', rotuloBotao: 'Agendar' },
      { nome: 'Barba', precoTexto: 'R$ 35,00', rotuloBotao: 'Agendar' },
      { nome: 'Corte + barba', precoTexto: 'R$ 70,00', rotuloBotao: 'Agendar' },
    ],
    servicos: [{ nome: 'Corte degradê' }, { nome: 'Hot towel' }, { nome: 'Pigmentação' }],
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
      texto: '10% no combo corte + barba',
      terminaEm: ends,
    },
    video: { youtubeId: 'jNQXAC9IVRw', titulo: 'Ambiente' },
    redes: [{ tipo: 'instagram', url: 'https://instagram.com/barbeariadocentro' }],
    pix: { chave: 'barbearia@demo.sejaengajado.com.br', nome: 'Barbearia do Centro' },
    seo: {
      title: 'Barbearia do Centro | Corte e barba em Uberaba',
      description: 'Barbearia no centro de Uberaba — agende no WhatsApp.',
      about: 'Cortes clássicos e modernos com atendimento rápido.',
      ogImageUrl: `${base}/samples/barbearia.svg`,
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
    theme: { niche: 'generico' as const, brandColor: '#0f766e' },
    businessName: 'Estúdio Luz Local',
    profile: {
      nome: 'Estúdio Luz Local',
      slogan: 'Fotos e serviços para o seu negócio',
      logoUrl: `${base}/samples/estudio.svg`,
      cidade: 'Uberaba',
      uf: 'MG',
      tags: ['foto', 'estúdio', 'serviço'],
    },
    whatsapp: { numero: '5534999990003', mensagem: 'Olá! Quero orçamento no Estúdio Luz.' },
    phone: '3433336666',
    links: [
      { tipo: 'url' as const, titulo: 'Portfólio', url: `${base}/samples/estudio.svg` },
      { tipo: 'instagram' as const, titulo: 'Instagram', url: 'https://instagram.com/estudioluz' },
    ],
    products: [
      { nome: 'Ensaio produto (10 fotos)', precoTexto: 'R$ 350,00' },
      { nome: 'Fachada + equipe', precoTexto: 'R$ 480,00' },
    ],
    servicos: [{ nome: 'Ensaio de produto' }, { nome: 'Foto de equipe' }, { nome: 'Fachada' }],
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
    pix: { chave: 'estudio@demo.sejaengajado.com.br', nome: 'Estúdio Luz Local' },
    seo: {
      title: 'Estúdio Luz Local | Fotografia em Uberaba',
      description: 'Fotos para negócios locais em Uberaba.',
      about: 'Estúdio focado em marcas locais e redes sociais.',
      ogImageUrl: `${base}/samples/estudio.svg`,
    },
    strip: { enabled: false, motif: 'none' as const, speed: 'normal' as const, direction: 'left' as const },
    faq: [
      {
        question: 'Atendem empresas?',
        answer: 'Sim — ensaio de produto, equipe e fachada.',
      },
    ],
    timezone: 'America/Sao_Paulo',
  };
}

export function formulaDemoClinica(base: string) {
  return {
    theme: { niche: 'saude' as const, brandColor: '#0f5c4c', variante: 'f4' as const },
    businessName: 'Clínica Serenidade — Psicologia & Terapia',
    profile: {
      nome: 'Clínica Serenidade — Psicologia & Terapia',
      slogan: 'Psicoterapia, acolhimento ético e saúde emocional — online e presencial',
      logoUrl: `${base}/samples/estudio.svg`,
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
        nome: 'Sessão individual (50 min)',
        precoTexto: 'Sob consulta',
        rotuloBotao: 'Agendar sessão',
        tag: 'Presencial ou Online',
        categoria: 'Psicoterapia',
      },
      {
        nome: 'Terapia de casal / familiar',
        precoTexto: 'Sob consulta',
        rotuloBotao: 'Agendar conversa',
        tag: '60 min',
        categoria: 'Casal & Família',
      },
      {
        nome: 'Acompanhamento mensal (4 sessões)',
        precoTexto: 'Plano mensal',
        rotuloBotao: 'Consultar disponibilidade',
        tag: 'Horário fixo semanal',
        categoria: 'Planos',
      },
    ],
    servicos: [
      { nome: 'Psicoterapia individual (adultos e adolescentes)' },
      { nome: 'Ansiedade, estresse e esgotamento (burnout)' },
      { nome: 'Autoconhecimento, autoestima e regulação emocional' },
      { nome: 'Terapia de casal e conflitos de relacionamento' },
      { nome: 'Orientação parental e familiar' },
      { nome: 'Atendimento psicológico online (vídeo com sigilo)' },
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
    pix: { chave: 'clinica@demo.sejaengajado.com.br', nome: 'Clínica Serenidade Psicologia' },
    seo: {
      title: 'Clínica Serenidade | Psicologia e Terapia em Uberaba',
      description:
        'Psicoterapia individual, terapia de casal e atendimento online em Uberaba — agende pelo WhatsApp.',
      about:
        'Consultório e clínica de psicologia com foco em escuta ética (CRP), acolhimento humanizado e saúde emocional.',
      ogImageUrl: `${base}/samples/estudio.svg`,
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
