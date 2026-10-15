import { Module, type DynamicModule } from '@nestjs/common';

import type { Env } from '../config/env';
import { AuthController } from './auth.controller';
import { HttpSupabaseAdminClient } from './http-supabase-admin';
import { SUPABASE_ADMIN } from './supabase-admin';

@Module({})
export class AuthModule {
  static register(env: Env): DynamicModule {
    return {
      module: AuthModule,
      controllers: [AuthController],
      providers: [
        {
          provide: SUPABASE_ADMIN,
          useFactory: () =>
            new HttpSupabaseAdminClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY),
        },
      ],
      exports: [SUPABASE_ADMIN],
    };
  }
}
