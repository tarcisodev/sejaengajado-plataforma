import { ChangeDetectionStrategy, Component, isDevMode } from '@angular/core';

import { DIVIDER_SHAPES, DividerShape } from '../ui/divider-path';
import { SectionDividerComponent } from '../ui/section-divider.component';

@Component({
  selector: 'app-divisores-demo',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [SectionDividerComponent],
  template: `
    <main class="demo" data-dev-divisores>
      <h1>Divisores de seção</h1>
      <p>Página de demonstração (somente em modo de desenvolvimento).</p>
      @for (shape of shapes; track shape) {
        <section class="sample" [attr.data-demo-shape]="shape">
          <h2>{{ shape }}</h2>
          <div class="from">
            <span>from</span>
            <app-section-divider
              [shape]="shape"
              [height]="56"
              fromColor="#c45c26"
              toColor="#f7f2ea"
            />
          </div>
          <div class="to">to ({{ shape }})</div>
          @if (shape !== 'reta' && shape !== 'none') {
            <div class="from flipped">
              <span>flip</span>
              <app-section-divider
                [shape]="shape"
                [height]="48"
                [flip]="true"
                fromColor="#6d28d9"
                toColor="#f4f7f6"
              />
            </div>
          }
        </section>
      }
    </main>
  `,
  styles: `
    .demo {
      max-width: 42rem;
      margin: 0 auto;
      padding: 1.5rem 1rem 3rem;
      font-family: system-ui, sans-serif;
      color: #1a1a1a;
      background: #fafafa;
      min-height: 100vh;
    }

    h1 {
      margin: 0 0 0.35rem;
      font-size: 1.5rem;
    }

    p {
      margin: 0 0 1.5rem;
      color: #555;
    }

    .sample {
      margin-bottom: 1.75rem;
    }

    h2 {
      margin: 0 0 0.5rem;
      font-size: 0.95rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .from {
      background: linear-gradient(120deg, #c45c26, #e8873a);
      color: #fff;
      padding-top: 2rem;
    }

    .from span {
      display: block;
      padding: 0 1rem 0.5rem;
      font-size: 0.8rem;
      opacity: 0.85;
    }

    .from.flipped {
      margin-top: 0.75rem;
      background: linear-gradient(120deg, #6d28d9, #8b5cf6);
    }

    .to {
      background: #f7f2ea;
      padding: 1rem;
      font-size: 0.85rem;
      color: #444;
    }
  `,
})
export class DivisoresDemoComponent {
  readonly shapes: readonly DividerShape[] = DIVIDER_SHAPES.filter((s) => s !== 'none');

  constructor() {
    if (!isDevMode()) {
      throw new Error('DivisoresDemoComponent is only available in development');
    }
  }
}
