import { SetMetadata } from '@nestjs/common';

import type { UserRole } from '../common/roles';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export const ALLOW_AAL1_KEY = 'allowAal1';

/**
 * Kept for callers that still annotate `/auth/me`. MFA is optional platform-wide;
 * aal1 (e-mail + password) is accepted on ADMIN/RESELLER routes.
 */
export const AllowAal1 = () => SetMetadata(ALLOW_AAL1_KEY, true);
