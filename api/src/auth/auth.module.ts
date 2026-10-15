import { Global, Module, type DynamicModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import type { Env } from '../config/env';
import { AuthContextInterceptor } from './auth-context.interceptor';
import { AuthController } from './auth.controller';
import { HttpSupabaseAdminClient } from './http-supabase-admin';
import { SUPABASE_ADMIN } from './supabase-admin';

@Global()
@Module({})
export class AuthModule {
  static register(env: Env): DynamicModule {
    return {
      module: AuthModule,
      global: true,
      controllers: [AuthController],
      providers: [
        {
          provide: SUPABASE_ADMIN,
          useFactory: () =>
            new HttpSupabaseAdminClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY),
        },
        { provide: APP_INTERCEPTOR, useClass: AuthContextInterceptor },
      ],
      exports: [SUPABASE_ADMIN],
    };
  }
}
