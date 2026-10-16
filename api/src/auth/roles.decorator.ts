import { SetMetadata } from '@nestjs/common';

import type { UserRole } from '../common/roles';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export const ALLOW_AAL1_KEY = 'allowAal1';

/**
 * Route reachable with an aal1 (password-only) session, e.g. `/auth/me` used by the
 * login/MFA step. Everything else under @Roles('RESELLER') requires aal2.
 */
export const AllowAal1 = () => SetMetadata(ALLOW_AAL1_KEY, true);
