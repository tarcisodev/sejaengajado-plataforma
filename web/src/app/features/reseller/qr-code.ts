import QRCode from 'qrcode';

export async function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: 'svg',
    margin: 2,
    width: 256,
    errorCorrectionLevel: 'M',
  });
}

export async function qrPngDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    margin: 2,
    width: 512,
    errorCorrectionLevel: 'M',
  });
}
