/** Origin CEP (Uberaba/MG) — Melhor Envio `from.postal_code`. */
export const SHIPPING_ORIGIN_CEP = '38035-080';

/** Required by Melhor Envio on every request. */
export const MELHORENVIO_USER_AGENT = 'SejaEngajado (contato@tarciso.dev)';

/**
 * Default plaque parcel (cm / kg) for cotação.
 * Single NFC/QR plate in protective packaging.
 */
export const PLAQUE_SHIPPING_PRODUCT = {
  id: 'PLACA',
  width: 10,
  height: 15,
  length: 2,
  weight: 0.1,
  quantity: 1,
} as const;
