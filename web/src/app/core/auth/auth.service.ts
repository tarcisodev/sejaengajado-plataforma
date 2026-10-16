import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { AuthMe } from './auth.types';
import { ensureSupabaseBrowser } from './supabase-browser';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);

  /** Perfil da API (`/api/auth/me`). */
  readonly me = signal<AuthMe | null>(null);
  /** true após a 1ª resolução de sessão no browser. */
  readonly ready = signal(false);

  private boot?: Promise<void>;
  private authSub: { unsubscribe: () => void } | null = null;

  /** Garante init + `onAuthStateChange` no browser (no-op no servidor). */
  ensureReady(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      this.ready.set(true);
      return Promise.resolve();
    }
    if (!this.boot) {
      this.boot = this.bootstrap();
    }
    return this.boot;
  }

  async signInWithOtp(email: string): Promise<void> {
    const sb = await this.requireClient();
    const { error } = await sb.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: false },
    });
    if (error) {
      throw error;
    }
  }

  async verifyOtp(email: string, token: string): Promise<AuthMe> {
    const sb = await this.requireClient();
    const { error } = await sb.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: token.replace(/\D/g, ''),
      type: 'email',
    });
    if (error) {
      throw error;
    }
    return this.refreshMe();
  }

  async refreshMe(): Promise<AuthMe> {
    const profile = await firstValueFrom(this.http.get<AuthMe>(`${this.apiBase()}/auth/me`));
    this.me.set(profile);
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

  /** Nível MFA atual (`sb.auth.mfa.getAuthenticatorAssuranceLevel`). */
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

  private async bootstrap(): Promise<void> {
    const sb = await ensureSupabaseBrowser();
    if (!sb) {
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
    this.ready.set(true);
  }

  private async handleAuthEvent(event: AuthChangeEvent, session: Session | null): Promise<void> {
    if (event === 'SIGNED_OUT') {
      this.me.set(null);
      return;
    }
    await this.onSession(session);
  }

  private async onSession(session: Session | null): Promise<void> {
    if (!session?.access_token) {
      this.me.set(null);
      return;
    }
    try {
      await this.refreshMe();
    } catch {
      this.me.set(null);
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

  /** Remove restos de sessão (incl. chaves `sb-*-auth-token`). */
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
