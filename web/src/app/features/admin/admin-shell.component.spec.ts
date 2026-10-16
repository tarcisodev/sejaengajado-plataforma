import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { API_PORT } from '../../core/api/api-port';
import { AuthService } from '../../core/auth/auth.service';
import { MockApiService } from '../../mocks/mock-api.service';
import { AdminShellComponent } from './admin-shell.component';

describe('AdminShellComponent', () => {
  it('links every admin section under /admin', () => {
    TestBed.configureTestingModule({
      imports: [AdminShellComponent],
      providers: [
        provideRouter([]),
        MockApiService,
        { provide: API_PORT, useExisting: MockApiService },
        {
          provide: AuthService,
          useValue: {
            me: signal({
              id: 'a1',
              email: 'admin@example.com',
              role: 'ADMIN',
              resellerId: null,
              status: 'ACTIVE',
              aal: 'aal2',
            }),
            signOut: async () => undefined,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(AdminShellComponent);
    fixture.detectChanges();
    const hrefs = [
      ...fixture.nativeElement.querySelectorAll('nav[aria-label="Painel admin"] a'),
    ].map((link) => (link as HTMLAnchorElement).getAttribute('href'));
    fixture.destroy();

    // Com apiUrl setado (environment de teste), telas sem endpoint ficam ocultas.
    expect(hrefs).toEqual([
      '/admin/revendedores',
      '/admin/planos',
      '/admin/configuracoes',
      '/admin/cupons',
    ]);
  });
});
