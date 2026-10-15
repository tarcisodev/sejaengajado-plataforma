import { Module, type DynamicModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { AuthModule } from './auth/auth.module';
import { RolesGuard } from './auth/roles.guard';
import { SupabaseJwtGuard } from './auth/supabase-jwt.guard';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { ENV, type Env } from './config/env';
import { HealthController } from './health/health.controller';
import { PgReadyProbe, READY_PROBE } from './health/ready';
import { loggerParams } from './logging/redact';
import { FakeGateway } from './payments/fake-gateway';
import { PAYMENT_GATEWAY } from './payments/payment-gateway';
import { PrismaModule } from './tenant/prisma.module';
import { TenantScopeGuard } from './tenant/tenant-scope.guard';

@Module({})
export class AppModule {
  static register(env: Env): DynamicModule {
    return {
      module: AppModule,
      imports: [
        LoggerModule.forRoot(loggerParams),
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
        PrismaModule.register(env),
        AuthModule.register(env),
      ],
      controllers: [HealthController],
      providers: [
        { provide: ENV, useValue: env },
        PgReadyProbe,
        { provide: READY_PROBE, useExisting: PgReadyProbe },
        FakeGateway,
        { provide: PAYMENT_GATEWAY, useExisting: FakeGateway },
        { provide: APP_FILTER, useClass: ApiExceptionFilter },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_GUARD, useClass: SupabaseJwtGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: TenantScopeGuard },
      ],
      exports: [PAYMENT_GATEWAY, FakeGateway, PrismaModule],
    };
  }
}
