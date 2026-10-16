import { MelhorEnvioClient } from './melhor-envio.client';
import { MELHORENVIO_USER_AGENT, SHIPPING_ORIGIN_CEP } from './shipping.constants';

describe('MelhorEnvioClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('POSTs calculate with Bearer, User-Agent and origin CEP', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: 1,
          name: 'PAC',
          company: { name: 'Correios' },
          custom_price: '24.90',
          custom_delivery_time: 7,
        },
        {
          id: 2,
          name: 'SEDEX',
          company: { name: 'Correios' },
          price: 41.9,
          delivery_time: 3,
          error: 'Sem cobertura',
        },
      ],
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = new MelhorEnvioClient({
      baseUrl: 'https://melhorenvio.test',
      token: 'test-token',
    });

    const options = await client.calculate({
      destinationCep: '01310-100',
      insuranceCents: 9_900,
    });

    expect(options).toEqual([
      {
        serviceId: '1',
        name: 'PAC',
        company: 'Correios',
        priceCents: 2490,
        deliveryDays: 7,
      },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://melhorenvio.test/api/v2/me/shipment/calculate');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer test-token',
      'User-Agent': MELHORENVIO_USER_AGENT,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    });
    const payload = JSON.parse(String(init.body)) as {
      from: { postal_code: string };
      to: { postal_code: string };
      products: { insurance_value: number }[];
    };
    expect(payload.from.postal_code).toBe(SHIPPING_ORIGIN_CEP.replace(/\D/g, ''));
    expect(payload.to.postal_code).toBe('01310100');
    expect(payload.products[0].insurance_value).toBe(99);
  });
});
