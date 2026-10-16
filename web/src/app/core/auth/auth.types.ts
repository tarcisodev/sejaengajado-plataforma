import type { UserRole } from '../models/domain';

export type AalLevel = 'aal1' | 'aal2';

/** Payload de `GET /api/auth/me` (papel vem do DB, não do JWT). */
export interface AuthMe {
  id: string;
  email: string;
  role: UserRole;
  resellerId: string | null;
  status: string;
  aal: AalLevel;
}
