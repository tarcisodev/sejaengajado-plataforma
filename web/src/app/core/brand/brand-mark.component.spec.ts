import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ThemeService } from '../theme/theme.service';
import { BRAND_ASSETS } from './brand-assets';
import { BrandMarkComponent } from './brand-mark.component';

describe('BrandMarkComponent', () => {
  let fixture: ComponentFixture<BrandMarkComponent>;
  let theme: ThemeService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BrandMarkComponent],
    }).compileComponents();
    theme = TestBed.inject(ThemeService);
    theme.setTheme('light');
    fixture = TestBed.createComponent(BrandMarkComponent);
    fixture.detectChanges();
  });

  it('renders the light lockup by default', () => {
    const img = fixture.nativeElement.querySelector('[data-brand-mark]') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe(BRAND_ASSETS.lockup);
    expect(img.getAttribute('alt')).toBe('Seja Engajado');
  });

  it('switches to the dark lockup and symbol assets', () => {
    theme.setTheme('dark');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-brand-mark]')?.getAttribute('src')).toBe(
      BRAND_ASSETS.lockupDark,
    );

    fixture.componentRef.setInput('variant', 'symbol');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-brand-mark]')?.getAttribute('src')).toBe(
      BRAND_ASSETS.symbolDark,
    );
  });
});
