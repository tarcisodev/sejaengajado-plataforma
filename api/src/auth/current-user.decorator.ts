import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { AuthUser } from './auth-user';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const req = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!req.user) {
      throw new Error('CurrentUser used without authenticated request');
    }
    return req.user;
  },
);
