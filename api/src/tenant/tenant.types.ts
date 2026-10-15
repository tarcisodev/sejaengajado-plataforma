import type { UserRole } from '../common/roles';

export interface TenantActor {
  userId: string;
  role: UserRole;
  /** Set for RESELLER and CUSTOMER. ADMIN uses adminPrisma instead. */
  resellerId: string | null;
}

export class TenantScopeMissingError extends Error {
  constructor(message = 'Tenant scope missing') {
    super(message);
    this.name = 'TenantScopeMissingError';
  }
}
