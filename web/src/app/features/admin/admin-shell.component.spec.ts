import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { API_PORT } from '../../core/api/api-port';
import { MockApiService } from '../../mocks/mock-api.service';
import { AdminShellComponent } from './admin-shell.component';

describe('AdminShellComponent', () => {
  it('links every admin section', async () => {
    TestBed.configureTestingModule({
      imports: [AdminShellComponent],
      providers: [
        provideRouter([]),
        MockApiService,
        { provide: API_PORT, useExisting: MockApiService },
      ],
    });
    const fixture = TestBed.createComponent(AdminShellComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const hrefs = [...fixture.nativeElement.querySelectorAll('a')].map((link) =>
      (link as HTMLAnchorElement).getAttribute('href'),
    );

    expect(hrefs).toEqual([
      '/',
      '/clientes',
      '/revendedores',
      '/sites',
      '/planos',
      '/configuracoes',
      '/cupons',
      '/receita',
    ]);
  });
});
