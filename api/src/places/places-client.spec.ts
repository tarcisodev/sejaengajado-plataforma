import { toMatch } from './places-client';

describe('places-client toMatch', () => {
  it('maps a place into name, phone and address', () => {
    const match = toMatch({
      displayName: { text: 'Padaria Central' },
      nationalPhoneNumber: '(34) 3333-0000',
      addressComponents: [
        { longText: 'Rua A', shortText: 'Rua A', types: ['route'] },
        { longText: '10', shortText: '10', types: ['street_number'] },
        { longText: 'Uberaba', shortText: 'Uberaba', types: ['locality'] },
        { longText: 'Minas Gerais', shortText: 'MG', types: ['administrative_area_level_1'] },
        { longText: '38000-000', shortText: '38000-000', types: ['postal_code'] },
      ],
    });

    expect(match).toEqual({
      nome: 'Padaria Central',
      telefone: '(34) 3333-0000',
      address: { logradouro: 'Rua A, 10', cidade: 'Uberaba', uf: 'MG', cep: '38000-000' },
    });
  });

  it('uses the city from the administrative area when locality is absent', () => {
    const match = toMatch({
      displayName: { text: 'Tarciso Dev' },
      nationalPhoneNumber: '(34) 9999-0000',
      formattedAddress: 'Rua dos Crisântemos, 322 - Lourdes, Uberaba - MG, 38035-080',
      addressComponents: [
        { longText: '322', shortText: '322', types: ['street_number'] },
        { longText: 'Rua dos Crisântemos', shortText: 'R. dos Crisântemos', types: ['route'] },
        { longText: 'Uberaba', shortText: 'Uberaba', types: ['administrative_area_level_2'] },
        { longText: 'Minas Gerais', shortText: 'MG', types: ['administrative_area_level_1'] },
        { longText: '38035-080', shortText: '38035-080', types: ['postal_code'] },
      ],
    });

    expect(match.address).toEqual({
      logradouro: 'Rua dos Crisântemos, 322',
      cidade: 'Uberaba',
      uf: 'MG',
      cep: '38035-080',
    });
  });
});
