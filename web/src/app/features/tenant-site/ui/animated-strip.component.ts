import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { StripDirection, StripMotif, StripSpeedPreset, stripSpeedSeconds } from './strip-motifs';

/** How many icons per track copy (duplicated for seamless loop). */
const ICONS_PER_TRACK = 10;

@Component({
  selector: 'app-animated-strip',
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    @if (enabled() && motif() !== 'none') {
      <div
        class="strip"
        aria-hidden="true"
        data-animated-strip
        [attr.data-motif]="motif()"
        [attr.data-direction]="direction()"
        [class.strip-off]="!enabled()"
        [style.--strip-duration.s]="duration()"
      >
        <div class="track" [class.track-reverse]="direction() === 'right'">
          @for (copy of copies; track copy) {
            <div class="rail" [attr.data-rail]="copy">
              @for (i of icons; track i) {
                <span class="item" [class.item-odd]="i % 2 === 1">
                  <svg class="icon" viewBox="0 0 32 32" focusable="false">
                    @switch (motif()) {
                      @case ('pizza') {
                        <path fill="currentColor" d="M16 3 L29 27 H3 Z" />
                        <circle cx="14" cy="16" r="1.6" fill="#fff" />
                        <circle cx="18" cy="20" r="1.4" fill="#fff" />
                        <circle cx="12" cy="22" r="1.2" fill="#fff" />
                      }
                      @case ('tesoura') {
                        <circle
                          cx="8"
                          cy="10"
                          r="3.2"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                        />
                        <circle
                          cx="8"
                          cy="22"
                          r="3.2"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                        />
                        <path
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          d="M10.5 11.5 L24 24 M10.5 20.5 L24 8"
                        />
                      }
                      @case ('circulos') {
                        <circle
                          cx="10"
                          cy="16"
                          r="5"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                        />
                        <circle
                          cx="20"
                          cy="16"
                          r="5"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                        />
                      }
                      @case ('estrelas') {
                        <path
                          fill="currentColor"
                          d="M16 4 L18.5 12 H27 L20.5 17 L23 25 L16 20 L9 25 L11.5 17 L5 12 H13.5 Z"
                        />
                      }
                      @case ('agulha') {
                        <path
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          d="M8 24 L24 8"
                        />
                        <circle
                          cx="25.5"
                          cy="6.5"
                          r="2.2"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                        />
                      }
                      @case ('coracao') {
                        <path
                          fill="currentColor"
                          d="M16 27 C16 27 5 19 5 12.5 C5 9 7.5 7 10.5 7 C13 7 14.8 8.4 16 10.2 C17.2 8.4 19 7 21.5 7 C24.5 7 27 9 27 12.5 C27 19 16 27 16 27 Z"
                        />
                      }
                    }
                  </svg>
                </span>
              }
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      color: var(--t-primary, #1e3a5f);
      background: color-mix(in srgb, var(--t-primary, #1e3a5f) 8%, var(--t-surface, #fff));
      overflow: hidden;
    }

    .strip {
      --strip-duration: 22s;
      height: 2.75rem;
      overflow: hidden;
    }

    .track {
      display: flex;
      width: max-content;
      height: 100%;
      will-change: transform;
      animation: strip-scroll var(--strip-duration) linear infinite;
    }

    .track-reverse {
      animation-direction: reverse;
    }

    .rail {
      display: flex;
      align-items: center;
      flex: 0 0 auto;
      gap: 1.25rem;
      padding: 0 0.625rem;
      height: 100%;
    }

    .item {
      display: grid;
      place-items: center;
      width: 1.75rem;
      height: 1.75rem;
      transform: translateY(0);
    }

    .item-odd {
      transform: translateY(0.2rem);
    }

    .icon {
      width: 1.35rem;
      height: 1.35rem;
      display: block;
    }

    .strip:hover .track,
    .strip:focus-within .track {
      animation-play-state: paused;
    }

    @keyframes strip-scroll {
      from {
        transform: translate3d(0, 0, 0);
      }
      to {
        transform: translate3d(-50%, 0, 0);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .track {
        animation: none;
        transform: none;
      }
    }
  `,
})
export class AnimatedStripComponent {
  readonly copies = [0, 1] as const;
  readonly icons = Array.from({ length: ICONS_PER_TRACK }, (_, i) => i);

  readonly enabled = input(true);
  readonly motif = input<StripMotif>('circulos');
  /** Seconds per cycle, or API preset `slow` | `normal` | `fast`. */
  readonly speed = input<number | StripSpeedPreset>(22);
  /** Default left = content moves left (direita → esquerda). */
  readonly direction = input<StripDirection>('left');

  readonly duration = computed(() => stripSpeedSeconds(this.speed()));
}
