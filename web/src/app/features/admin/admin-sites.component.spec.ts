import { ComponentFixture, TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { API_PORT } from '../../core/api/api-port';
import { MockApiService } from '../../mocks/mock-api.service';
import { AdminSitesComponent } from './admin-sites.component';

describe('AdminSitesComponent', () => {
  let fixture: ComponentFixture<AdminSitesComponent>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [AdminSitesComponent],
      providers: [MockApiService, { provide: API_PORT, useExisting: MockApiService }],
    });
    fixture = TestBed.createComponent(AdminSitesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('filters by status and reactivates a suspended site', async () => {
    fixture.componentInstance.status.set('SUSPENDED');
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Oficina Suspensa');
    expect(text).not.toContain('Barbearia do Zé');

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.textContent).toContain('Reativar');
    button.click();
    fixture.detectChanges();

    const sites = await firstValueFrom(TestBed.inject(MockApiService).listSites());
    expect(sites.find((site) => site.slug === 'oficina-suspensa')?.status).toBe('PUBLISHED');
  });
});
