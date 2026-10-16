import type { UserRole } from '../common/roles';

export interface AuthUser {
  id: string;
  supabaseId: string;
  email: string;
  role: UserRole;
  resellerId: string | null;
  status: string;
  /** Status do tenant (ACTIVE | DELINQUENT | BLOCKED); só RESELLER. */
  resellerStatus: string | null;
  aal: 'aal1' | 'aal2';
}
