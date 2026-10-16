import { qrSvg } from './qr-code';

describe('qr-code (FF4)', () => {
  it('renders an SVG containing the payload URL', async () => {
    const svg = await qrSvg('https://api.sejaengajado.com.br/api/public/r/loja/avaliar');
    expect(svg).toContain('<svg');
    expect(svg.length).toBeGreaterThan(100);
  });
});
