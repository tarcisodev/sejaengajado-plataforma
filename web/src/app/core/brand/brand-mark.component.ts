import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { ThemeService } from '../theme/theme.service';
import { BRAND_ASSETS, BRAND_NAME } from './brand-assets';

export type BrandMarkVariant = 'lockup' | 'symbol';

@Component({
  selector: 'app-brand-mark',
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <img
      [src]="src()"
      [alt]="alt()"
      [attr.width]="width()"
      [attr.height]="height()"
      [class]="imgClass()"
      data-brand-mark
      [attr.data-variant]="variant()"
      decoding="async"
    />
  `,
})
export class BrandMarkComponent {
  private readonly theme = inject(ThemeService);

  readonly variant = input<BrandMarkVariant>('lockup');
  /** CSS height class or empty for intrinsic. */
  readonly heightClass = input('h-8');
  readonly decorative = input(false);

  readonly src = computed(() => {
    const dark = this.theme.theme() === 'dark';
    if (this.variant() === 'symbol') {
      return dark ? BRAND_ASSETS.symbolDark : BRAND_ASSETS.symbol;
    }
    return dark ? BRAND_ASSETS.lockupDark : BRAND_ASSETS.lockup;
  });

  readonly alt = computed(() => (this.decorative() ? '' : BRAND_NAME));

  readonly width = computed(() => (this.variant() === 'symbol' ? 32 : 150));
  readonly height = computed(() => (this.variant() === 'symbol' ? 32 : 32));

  readonly imgClass = computed(() => {
    const base = 'block w-auto max-w-full object-contain object-left';
    return this.heightClass() ? `${base} ${this.heightClass()}` : base;
  });
}
