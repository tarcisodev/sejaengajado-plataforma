import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { toMatch } from './google-places-client';
import { GooglePlacesService } from './google-places.service';

describe('GooglePlacesService', () => {
  it('does not call Google when the key is empty', () => {
    TestBed.configureTestingModule({
      providers: [GooglePlacesService, provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);
    const service = TestBed.inject(GooglePlacesService);
    let message = '';

    service.search('Padaria').subscribe({
      error: (error: Error) => {
        message = error.message;
      },
    });

    http.expectNone(() => true);
    expect(message).toBe('Busca do Google indisponível: falta a chave.');
  });

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
});
