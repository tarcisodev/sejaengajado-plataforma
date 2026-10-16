import { ComponentFixture, TestBed } from '@angular/core/testing';

import { API_PORT } from '../../core/api/api-port';
import { MockApiService } from '../../mocks/mock-api.service';
import { AdminPlaquesComponent } from './admin-plaques.component';

describe('AdminPlaquesComponent', () => {
  let fixture: ComponentFixture<AdminPlaquesComponent>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [AdminPlaquesComponent],
      providers: [MockApiService, { provide: API_PORT, useExisting: MockApiService }],
    });
    fixture = TestBed.createComponent(AdminPlaquesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('loads stock for the selected reseller', () => {
    expect(fixture.nativeElement.querySelector('[data-plaque-stock]')).toBeTruthy();
    expect(fixture.componentInstance.resellerId()).toBeTruthy();
  });

  it('posts an IN movement with Idempotency-Key via ApiPort', async () => {
    const api = TestBed.inject(MockApiService);
    const spy = spyOn(api, 'postAdminPlaqueMovement').and.callThrough();
    const form = fixture.nativeElement.querySelector('[data-plaque-in]') as HTMLFormElement;
    (form.querySelector('input[name="qty"]') as HTMLInputElement).value = '5';
    (form.querySelector('input[name="unitCostCents"]') as HTMLInputElement).value = '100';
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(spy).toHaveBeenCalled();
    const [body, key] = spy.calls.mostRecent().args;
    expect(body.type).toBe('IN');
    expect(body.qty).toBe(5);
    expect(typeof key).toBe('string');
    expect(key.length).toBeGreaterThan(8);
  });
});
