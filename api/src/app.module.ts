import { Module, type DynamicModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { PlatformConfigModule } from './admin/config/config.module';
import { CouponsModule } from './admin/coupons/coupons.module';
import { PlansModule } from './admin/plans/plans.module';
import { ProductsModule } from './admin/products/products.module';
import { ResellersModule } from './admin/resellers/resellers.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { RolesGuard } from './auth/roles.guard';
import { SupabaseJwtGuard } from './auth/supabase-jwt.guard';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { ConfigModule } from './config/config.module';
import type { Env } from './config/env';
import { CustomerModule } from './customer/customer.module';
import { HealthController } from './health/health.controller';
import { PgReadyProbe, READY_PROBE } from './health/ready';
import { JobsModule } from './jobs/jobs.module';
import { LedgerModule } from './ledger/ledger.module';
import { loggerParams } from './logging/redact';
import { PaymentsModule } from './payments/payments.module';
import { PlacesModule } from './places/places.module';
import { PublicModule } from './public/public.module';
import { ReportsModule } from './reports/reports.module';
import { ResellerModule } from './reseller/reseller.module';
import { SalesModule } from './sales/sales.module';
import { StockModule } from './stock/stock.module';
import { PrismaModule } from './tenant/prisma.module';
import { TenantScopeGuard } from './tenant/tenant-scope.guard';
import { WholesaleModule } from './wholesale/wholesale.module';

@Module({})
export class AppModule {
  static register(env: Env): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.register(env),
        LoggerModule.forRoot(loggerParams),
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
        PrismaModule.register(env),
        AuthModule.register(env),
        AuditModule,
        ResellersModule,
        ProductsModule,
        PlansModule,
        CouponsModule,
        PlatformConfigModule,
        WholesaleModule,
        LedgerModule,
        StockModule,
        SalesModule,
        JobsModule,
        ReportsModule,
        PublicModule,
        ResellerModule,
        CustomerModule,
        PaymentsModule.register(),
        PlacesModule,
        BillingModule,
      ],
      controllers: [HealthController],
      providers: [
        PgReadyProbe,
        { provide: READY_PROBE, useExisting: PgReadyProbe },
        { provide: APP_FILTER, useClass: ApiExceptionFilter },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_GUARD, useClass: SupabaseJwtGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: TenantScopeGuard },
      ],
      exports: [PrismaModule, PaymentsModule],
    };
  }
}
