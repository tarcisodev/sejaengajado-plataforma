import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { API_PORT } from '../api/api-port';
import { MockApiService } from '../../mocks/mock-api.service';
import { TenantResolver } from './tenant-resolver';
import { applyHttpStatus } from './tenant-view';

describe('TenantResolver', () => {
  let resolver: TenantResolver;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TenantResolver,
        MockApiService,
        { provide: API_PORT, useExisting: MockApiService },
      ],
    });
    resolver = TestBed.inject(TenantResolver);
  });

  it('renders the landing on the apex and the panel on app.', async () => {
    expect((await firstValueFrom(resolver.resolve('sejaengajado.com.br'))).kind).toBe('landing');
    expect((await firstValueFrom(resolver.resolve('app.sejaengajado.com.br'))).kind).toBe('app');
  });

  it('renders a published site and a read-only site the same way', async () => {
    const published = await firstValueFrom(resolver.resolve('barbearia-do-ze.sejaengajado.com.br'));
    const readOnly = await firstValueFrom(
      resolver.resolve('localhost', '?tenant=salao-da-ana-unidades'),
    );

    expect(published.kind).toBe('site');
    if (published.kind === 'site') {
      expect(published.site.content.businessName).toBe('Barbearia do Zé');
    }
    expect(readOnly.kind).toBe('site');
    if (readOnly.kind === 'site') {
      expect(readOnly.site.status).toBe('READ_ONLY');
    }
  });

  it('returns a friendly miss for an unknown slug and for a draft', async () => {
    const missing = await firstValueFrom(resolver.resolve('localhost:4200', '?tenant=nao-existe'));
    const draft = await firstValueFrom(resolver.resolve('oficina-do-bairro.localhost'));

    expect(missing).toEqual({ kind: 'not-found', slug: 'nao-existe' });
    expect(draft).toEqual({ kind: 'not-found', slug: 'oficina-do-bairro' });
    const response: ResponseInit = {};
    applyHttpStatus(response, missing);
    expect(response.status).toBe(404);
  });

  it('shows a suspended site as temporarily unavailable', async () => {
    const view = await firstValueFrom(resolver.resolve('oficina-suspensa.localhost:4200'));

    expect(view).toEqual({ kind: 'suspended', businessName: 'Oficina Suspensa' });
    const response: ResponseInit = {};
    applyHttpStatus(response, view);
    expect(response.status).toBe(503);
    expect(new Headers(response.headers).get('Retry-After')).toBe('3600');
  });

  it('marks an archived site as gone', async () => {
    const view = await firstValueFrom(resolver.resolve('mercearia-do-arquivo.sejaengajado.com.br'));

    expect(view).toEqual({ kind: 'archived', businessName: 'Mercearia do Arquivo' });
    const response: ResponseInit = {};
    applyHttpStatus(response, view);
    expect(response.status).toBe(410);
  });
});
