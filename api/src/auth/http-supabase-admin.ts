import { Injectable } from '@nestjs/common';

import type {
  InvitedSupabaseUser,
  RecoveryLink,
  SupabaseAdminClient,
} from './supabase-admin';

@Injectable()
export class HttpSupabaseAdminClient implements SupabaseAdminClient {
  constructor(
    private readonly baseUrl: string,
    private readonly serviceRoleKey: string,
  ) {}

  async inviteUserByEmail(email: string): Promise<InvitedSupabaseUser> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/auth/v1/invite`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ email }),
    });
    if (!response.ok) {
      throw new Error(`Supabase invite failed (${response.status})`);
    }
    const body = (await response.json()) as { id?: string; email?: string };
    if (!body.id || !body.email) {
      throw new Error('Supabase invite response missing id/email');
    }
    return { id: body.id, email: body.email };
  }

  async generateRecoveryLink(email: string): Promise<RecoveryLink> {
    const response = await fetch(
      `${this.baseUrl.replace(/\/$/, '')}/auth/v1/admin/generate_link`,
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ type: 'recovery', email }),
      },
    );
    if (!response.ok) {
      throw new Error(`Supabase generate_link failed (${response.status})`);
    }
    const body = (await response.json()) as { action_link?: string };
    if (!body.action_link) {
      throw new Error('Supabase generate_link missing action_link');
    }
    return { actionLink: body.action_link };
  }

  async unenrollMfaFactors(supabaseUserId: string): Promise<{ removed: number }> {
    const base = this.baseUrl.replace(/\/$/, '');
    const list = await fetch(`${base}/auth/v1/admin/users/${supabaseUserId}/factors`, {
      method: 'GET',
      headers: this.headers(),
    });
    if (!list.ok) {
      throw new Error(`Supabase list factors failed (${list.status})`);
    }
    const body = (await list.json()) as { factors?: { id: string }[] } | { id: string }[];
    const factors = Array.isArray(body)
      ? body
      : Array.isArray(body.factors)
        ? body.factors
        : [];
    let removed = 0;
    for (const factor of factors) {
      if (!factor?.id) {
        continue;
      }
      const del = await fetch(
        `${base}/auth/v1/admin/users/${supabaseUserId}/factors/${factor.id}`,
        { method: 'DELETE', headers: this.headers() },
      );
      if (del.ok || del.status === 404) {
        removed += 1;
      }
    }
    return { removed };
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.serviceRoleKey}`,
      apikey: this.serviceRoleKey,
      'Content-Type': 'application/json',
    };
  }
}
