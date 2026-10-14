import { PlatformLocation } from '@angular/common';
import { RESPONSE_INIT } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { API_PORT } from '../../core/api/api-port';
import { Site } from '../../core/models/domain';
import { MockApiService } from '../../mocks/mock-api.service';
import { TenantResolver } from '../../core/tenant/tenant-resolver';
import { TenantView } from '../../core/tenant/tenant-view';
import { TenantGateComponent } from './tenant-gate.component';

describe('TenantGateComponent', () => {
  async function render(
    view: TenantView,
  ): Promise<{ fixture: ComponentFixture<TenantGateComponent>; status: ResponseInit }> {
    const status: ResponseInit = {};
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [TenantGateComponent],
      providers: [
        { provide: TenantResolver, useValue: { resolve: () => of(view) } },
        { provide: RESPONSE_INIT, useValue: status },
        MockApiService,
        { provide: API_PORT, useExisting: MockApiService },
        {
          provide: PlatformLocation,
          useValue: { hostname: 'localhost', port: '4200', search: '' },
        },
      ],
    });
    const fixture = TestBed.createComponent(TenantGateComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, status };
  }

  it('shows a friendly miss for an unknown slug', async () => {
    const { fixture, status } = await render({ kind: 'not-found', slug: 'nao-existe' });
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Não encontramos esse negócio');
    expect(text).toContain('nao-existe');
    expect(status.status).toBe(404);
  });

  it('shows the suspended page', async () => {
    const { fixture, status } = await render({
      kind: 'suspended',
      businessName: 'Oficina Suspensa',
    });

    expect(fixture.nativeElement.textContent).toContain('Temporariamente indisponível');
    expect(status.status).toBe(200);
  });

  it('shows the archived page with status 410', async () => {
    const { fixture, status } = await render({
      kind: 'archived',
      businessName: 'Mercearia do Arquivo',
    });

    expect(fixture.nativeElement.textContent).toContain('Indisponível permanente');
    expect(status.status).toBe(410);
  });

  it('renders a read-only site as a normal page', async () => {
    const site = {
      id: 'site_leitura',
      customerId: 'cust_ana',
      resellerId: 'res_triangulo',
      slug: 'salao-da-ana-unidades',
      customDomain: null,
      templateId: 'tpl_servicos',
      content: {
        businessName: 'Salão da Ana Unidades',
        profile: { nome: 'Salão da Ana Unidades', cidade: 'Uberaba', uf: 'MG' },
        theme: {
          p1: '#1e3a5f',
          p2: '#3d5a4c',
          p3: '#d5e2dc',
          on3: '#102018',
          hi: '#f4f7f6',
          fontHeading: 'Fraunces, Palatino, serif',
          fontBody: 'Literata, Georgia, serif',
          fontScale: 1,
          italic: 'normal',
        },
      },
      status: 'READ_ONLY',
      planId: 'plan_pro',
      editable: true,
      publishedAt: '2026-04-01',
      hostingRenewsAt: null,
      plaqueFidelityEndsAt: null,
    } satisfies Site;
    const { fixture } = await render({ kind: 'site', site });

    expect(fixture.nativeElement.textContent).toContain('Salão da Ana Unidades');
    expect(
      fixture.nativeElement.querySelector('[data-site-status]')?.getAttribute('data-site-status'),
    ).toBe('READ_ONLY');
  });
});
