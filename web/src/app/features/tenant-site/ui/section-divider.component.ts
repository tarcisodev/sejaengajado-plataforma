import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { DIVIDER_VIEWBOX, DividerShape, clampDividerHeight, dividerPath } from './divider-path';

@Component({
  selector: 'app-section-divider',
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    @if (showSvg()) {
      <svg
        class="divider-svg"
        [attr.viewBox]="'0 0 ' + viewBox.width + ' ' + viewBox.height"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
        [style.height.px]="resolvedHeight()"
        [style.transform]="transform()"
        data-section-divider
        [attr.data-shape]="shape()"
      >
        <path [attr.d]="path()" [attr.fill]="fromColor()" />
      </svg>
    } @else {
      <div
        class="divider-flat"
        aria-hidden="true"
        [style.height.px]="shape() === 'reta' ? resolvedHeight() : 0"
        [style.background]="fromColor()"
        data-section-divider
        [attr.data-shape]="shape()"
      ></div>
    }
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      line-height: 0;
      background: var(--divider-to, transparent);
      overflow: hidden;
    }

    .divider-svg {
      display: block;
      width: 100%;
      height: auto;
      transform-origin: center center;
    }

    .divider-flat {
      width: 100%;
    }
  `,
  host: {
    '[style.--divider-to]': 'toColor()',
    '[attr.data-flip]': 'flip() ? "true" : "false"',
    '[attr.data-invert]': 'invert() ? "true" : "false"',
  },
})
export class SectionDividerComponent {
  readonly viewBox = DIVIDER_VIEWBOX;

  readonly shape = input<DividerShape>('ondulada');
  readonly height = input(48);
  readonly flip = input(false);
  readonly invert = input(false);
  readonly fromColor = input('var(--t-primary, #6d28d9)');
  readonly toColor = input('var(--t-bg, #f4f7f6)');

  readonly resolvedHeight = computed(() => clampDividerHeight(this.height()));

  readonly path = computed(() => dividerPath(this.shape()));

  readonly showSvg = computed(() => this.path().length > 0);

  readonly transform = computed(() => {
    const parts: string[] = [];
    if (this.flip()) {
      parts.push('scaleX(-1)');
    }
    if (this.invert()) {
      parts.push('scaleY(-1)');
    }
    return parts.length ? parts.join(' ') : null;
  });
}
