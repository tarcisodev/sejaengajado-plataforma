import { isPlatformBrowser } from '@angular/common';
import {
  DOCUMENT,
  Injectable,
  PLATFORM_ID,
  afterNextRender,
  inject,
  signal,
} from '@angular/core';

export const THEME_STORAGE_KEY = 'seja.theme';

export type AppTheme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly theme = signal<AppTheme>('light');

  constructor() {
    afterNextRender(() => {
      this.apply(this.readStored());
    });
  }

  toggle(): void {
    this.apply(this.theme() === 'dark' ? 'light' : 'dark');
  }

  setTheme(theme: AppTheme): void {
    this.apply(theme);
  }

  private readStored(): AppTheme {
    if (!this.isBrowser) {
      return 'light';
    }
    return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  }

  private apply(theme: AppTheme): void {
    this.theme.set(theme);
    if (!this.isBrowser) {
      return;
    }
    this.document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }
}
