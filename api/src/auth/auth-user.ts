import type { UserRole } from '../common/roles';

export interface AuthUser {
  id: string;
  supabaseId: string;
  email: string;
  role: UserRole;
  resellerId: string | null;
  status: string;
  aal: 'aal1' | 'aal2';
}
