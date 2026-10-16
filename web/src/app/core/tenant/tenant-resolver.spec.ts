import { PLATFORM_ID, REQUEST_CONTEXT, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { API_PORT } from '../api/api-port';
import { AuthService } from '../auth/auth.service';
import { MockApiService } from '../../mocks/mock-api.service';
import { SSR_PUBLIC_SITE } from '../ssr/ssr-public-site';
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
        {
          provide: AuthService,
          useValue: {
            me: signal(null),
            sessionStatus: signal('anonymous'),
            ready: signal(true),
          },
        },
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

  it('reuses REQUEST_CONTEXT.publicSite without calling the API', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        TenantResolver,
        MockApiService,
        { provide: API_PORT, useExisting: MockApiService },
        {
          provide: AuthService,
          useValue: {
            me: signal(null),
            sessionStatus: signal('anonymous'),
            ready: signal(true),
          },
        },
        {
          provide: REQUEST_CONTEXT,
          useValue: {
            tenantSlug: 'demo-forno',
            publicSite: {
              status: 'PUBLISHED',
              slug: 'demo-forno',
              templateKey: 'restaurante',
              schemaType: 'Restaurant',
              content: { businessName: 'Forno da Praça', profile: { nome: 'Forno' }, theme: {} },
              temporarilyUnavailable: false,
            },
          },
        },
      ],
    });
    const withSsr = TestBed.inject(TenantResolver);
    const view = await firstValueFrom(withSsr.resolve('demo-forno.sejaengajado.com.br'));
    expect(view.kind).toBe('site');
    if (view.kind === 'site') {
      expect(view.site.content.businessName).toContain('Forno');
      expect(view.site.schemaType).toBe('Restaurant');
    }
  });

  it('on SSR without prefetch returns ssr-unavailable (502), never not-found', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        TenantResolver,
        MockApiService,
        { provide: API_PORT, useExisting: MockApiService },
        { provide: PLATFORM_ID, useValue: 'server' },
        {
          provide: AuthService,
          useValue: {
            me: signal(null),
            sessionStatus: signal('anonymous'),
            ready: signal(true),
          },
        },
        { provide: SSR_PUBLIC_SITE, useValue: null },
      ],
    });
    const resolver = TestBed.inject(TenantResolver);
    const view = await firstValueFrom(resolver.resolve('demo-forno.sejaengajado.com.br'));
    expect(view).toEqual({ kind: 'ssr-unavailable', slug: 'demo-forno' });
    const response: ResponseInit = {};
    applyHttpStatus(response, view);
    expect(response.status).toBe(502);
  });
});
