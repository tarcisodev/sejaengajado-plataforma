import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { environment } from '../../../environments/environment';
import { GooglePlacesService } from './google-places.service';

describe('GooglePlacesService', () => {
  it('rejects an empty query without calling the API', () => {
    TestBed.configureTestingModule({
      providers: [GooglePlacesService, provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);
    const service = TestBed.inject(GooglePlacesService);
    let message = '';

    service.search('   ').subscribe({
      error: (error: Error) => {
        message = error.message;
      },
    });

    http.expectNone(() => true);
    expect(message).toBe('Informe o nome do negócio.');
  });

  it('calls the API places search endpoint', () => {
    TestBed.configureTestingModule({
      providers: [GooglePlacesService, provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);
    const service = TestBed.inject(GooglePlacesService);
    const base = environment.apiUrl.replace(/\/$/, '');

    let rows: unknown[] | undefined;
    service.search('Padaria').subscribe((value) => {
      rows = value;
    });

    const req = http.expectOne(`${base}/places/search?q=Padaria`);
    expect(req.request.method).toBe('GET');
    req.flush([
      { nome: 'Padaria Central', telefone: '', address: { logradouro: '', cidade: '', uf: '' } },
    ]);
    expect(rows?.length).toBe(1);
  });
});
