import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { AuthMe } from './auth.types';
import { ensureSupabaseBrowser } from './supabase-browser';

export type SessionStatus = 'loading' | 'authenticated' | 'anonymous';

const BOOT_TIMEOUT_MS = 3_000;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);

  readonly me = signal<AuthMe | null>(null);
  readonly sessionStatus = signal<SessionStatus>('loading');
  readonly ready = signal(false);

  private boot?: Promise<void>;
  private authSub: { unsubscribe: () => void } | null = null;

  ensureReady(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      this.sessionStatus.set('anonymous');
      this.ready.set(true);
      return Promise.resolve();
    }
    if (!this.boot) {
      this.boot = this.bootstrapWithTimeout();
    }
    return this.boot;
  }

  async signInWithPassword(email: string, password: string): Promise<AuthMe> {
    const sb = await this.requireClient();
    const { error } = await sb.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) {
      throw error;
    }
    return this.refreshMe();
  }

  async requestPasswordReset(email: string): Promise<void> {
    const sb = await this.requireClient();
    const redirectTo =
      typeof window !== 'undefined' ? `${window.location.origin}/entrar` : undefined;
    const { error } = await sb.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo,
    });
    if (error) {
      throw error;
    }
  }

  async updatePassword(newPassword: string): Promise<void> {
    const sb = await this.requireClient();
    const { error } = await sb.auth.updateUser({ password: newPassword });
    if (error) {
      throw error;
    }
  }

  async refreshMe(): Promise<AuthMe> {
    const profile = await firstValueFrom(this.http.get<AuthMe>(`${this.apiBase()}/auth/me`));
    this.me.set(profile);
    this.sessionStatus.set('authenticated');
    return profile;
  }

  async signOut(): Promise<void> {
    if (isPlatformBrowser(this.platformId)) {
      const sb = await ensureSupabaseBrowser();
      if (sb) {
        await sb.auth.signOut();
      }
      this.clearBrowserResidue();
    }
    this.me.set(null);
    this.sessionStatus.set('anonymous');
    await this.router.navigateByUrl('/entrar');
  }

  homePathForRole(role: AuthMe['role']): string {
    switch (role) {
      case 'ADMIN':
        return '/admin';
      case 'RESELLER':
        return '/revenda';
      case 'CUSTOMER':
        return '/conta';
    }
  }

  async getAuthenticatorAssuranceLevel(): Promise<'aal1' | 'aal2' | null> {
    const sb = await ensureSupabaseBrowser();
    if (!sb) {
      return null;
    }
    const { data, error } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !data?.currentLevel) {
      return null;
    }
    return data.currentLevel === 'aal2' ? 'aal2' : 'aal1';
  }

  /**
   * Await bootstrap; only fall back to anonymous if it still has not finished
   * within BOOT_TIMEOUT_MS. Do not resolve ensureReady early — that raced
   * guards to /entrar while /api/auth/me was still in flight (broke F5).
   */
  private async bootstrapWithTimeout(): Promise<void> {
    let finished = false;
    const timer = setTimeout(() => {
      if (!finished && this.sessionStatus() === 'loading') {
        this.me.set(null);
        this.sessionStatus.set('anonymous');
        this.ready.set(true);
      }
    }, BOOT_TIMEOUT_MS);
    try {
      await this.bootstrap();
    } finally {
      finished = true;
      clearTimeout(timer);
      this.ready.set(true);
    }
  }

  private async bootstrap(): Promise<void> {
    try {
      const sb = await ensureSupabaseBrowser();
      if (!sb) {
        this.sessionStatus.set('anonymous');
        this.ready.set(true);
        return;
      }
      const {
        data: { session },
      } = await sb.auth.getSession();
      await this.onSession(session);
      const { data } = sb.auth.onAuthStateChange((event, next) => {
        void this.handleAuthEvent(event, next);
      });
      this.authSub = data.subscription;
    } finally {
      if (this.sessionStatus() === 'loading') {
        this.sessionStatus.set(this.me() ? 'authenticated' : 'anonymous');
      }
      this.ready.set(true);
    }
  }

  private async handleAuthEvent(event: AuthChangeEvent, session: Session | null): Promise<void> {
    if (event === 'SIGNED_OUT') {
      this.me.set(null);
      this.sessionStatus.set('anonymous');
      return;
    }
    await this.onSession(session);
  }

  private async onSession(session: Session | null): Promise<void> {
    if (!session?.access_token) {
      this.me.set(null);
      this.sessionStatus.set('anonymous');
      return;
    }
    try {
      await this.refreshMe();
    } catch {
      this.me.set(null);
      this.sessionStatus.set('anonymous');
    }
  }

  private async requireClient(): Promise<SupabaseClient> {
    const sb = await ensureSupabaseBrowser();
    if (!sb) {
      throw new Error('Supabase indisponível. Confira SUPABASE_URL / SUPABASE_ANON_KEY.');
    }
    return sb;
  }

  private apiBase(): string {
    return (environment.apiUrl || '/api').replace(/\/$/, '');
  }

  private clearBrowserResidue(): void {
    try {
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (/^sb-.*-auth-token$/i.test(key) || key.includes('auth-token'))) {
          keys.push(key);
        }
      }
      for (const key of keys) {
        localStorage.removeItem(key);
      }
    } catch {
      /* ignore */
    }
  }
}
