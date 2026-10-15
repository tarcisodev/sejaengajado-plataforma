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

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.serviceRoleKey}`,
      apikey: this.serviceRoleKey,
      'Content-Type': 'application/json',
    };
  }
}
