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
  /** Remove all MFA factors for the user (admin reset). */
  unenrollMfaFactors(supabaseUserId: string): Promise<{ removed: number }>;
  /** Set password via GoTrue Admin API (works even when session is aal1 with MFA enrolled). */
  updateUserPassword?(supabaseUserId: string, password: string): Promise<void>;
}
