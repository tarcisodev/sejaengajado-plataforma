import { plaqueNfcPayload, plaqueReviewUrl, plaqueSiteUrl } from './plaque-links';

describe('plaque-links (FF4)', () => {
  it('builds short review, site and NFC URLs for a slug', () => {
    expect(plaqueReviewUrl('Loja-Livre')).toBe(
      'https://api.sejaengajado.com.br/api/public/r/loja-livre/avaliar',
    );
    expect(plaqueSiteUrl('Loja-Livre')).toBe('https://loja-livre.sejaengajado.com.br/avaliar');
    expect(plaqueNfcPayload('loja-livre')).toBe(plaqueReviewUrl('loja-livre'));
  });
});
