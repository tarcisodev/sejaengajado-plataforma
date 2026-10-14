export const LANDING_TITLE = 'Seja Engajado | Site e placa de avaliação em Uberaba';

export const LANDING_DESCRIPTION =
  'Mini site com subdomínio próprio e placa de avaliação do Google para o comércio de Uberaba. Planos Pronto e Engajado Pro.';

export const LANDING_URL = 'https://sejaengajado.com.br/';

export const PLATFORM_WHATSAPP_E164 = '5534999990000';

export const WHATSAPP_HREF =
  'https://wa.me/5534999990000?text=' +
  encodeURIComponent('Olá, quero um site para o meu negócio em Uberaba.');

export function formatBrl(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
