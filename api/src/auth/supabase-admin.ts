export const SUPABASE_ADMIN = Symbol('SUPABASE_ADMIN');

export interface InvitedSupabaseUser {
  id: string;
  email: string;
}

export interface RecoveryLink {
  actionLink: string;
}

export interface SupabaseAdminClient {
  inviteUserByEmail(email: string): Promise<InvitedSupabaseUser>;
  generateRecoveryLink(email: string): Promise<RecoveryLink>;
}
