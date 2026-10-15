import {
  Global,
  Inject,
  Injectable,
  Module,
  OnModuleDestroy,
  OnModuleInit,
  type DynamicModule,
} from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';

import type { Env } from '../config/env';
import { createAdminPrismaProxy } from './admin-prisma.proxy';
import { createTenantPrismaProxy } from './prisma-tenant.extension';
import { TenantContextInterceptor } from './tenant-context.interceptor';

export const PRISMA = Symbol('PRISMA');
export const ADMIN_PRISMA = Symbol('ADMIN_PRISMA');
/**
 * Ungated se_admin (BYPASSRLS). Inject only in webhooks/jobs (+ auth bootstrap,
 * public by-host, ledger append). Controllers must never inject — see
 * `scripts/lint-system-prisma.mjs`.
 */
export const SYSTEM_PRISMA = Symbol('SYSTEM_PRISMA');
/**
 * Raw se_app client (no tenant proxy). Use for multi-step interactive
 * transactions with SET LOCAL app.reseller_id — the proxied client nests
 * a $transaction per model op and would commit mid-flight.
 */
export const APP_PRISMA = Symbol('APP_PRISMA');

export type AdminPrisma = PrismaClient;
export type TenantPrisma = PrismaClient;
export type SystemPrisma = PrismaClient;
export type AppPrisma = PrismaClient;

@Injectable()
export class PrismaLifecycle implements OnModuleInit, OnModuleDestroy {
  constructor(
    @Inject(APP_PRISMA) private readonly appPrisma: PrismaClient,
    @Inject(SYSTEM_PRISMA) private readonly systemPrisma: PrismaClient,
  ) {}

  async onModuleInit(): Promise<void> {
    await Promise.all([this.appPrisma.$connect(), this.systemPrisma.$connect()]);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.appPrisma.$disconnect(), this.systemPrisma.$disconnect()]);
  }
}

@Global()
@Module({})
export class PrismaModule {
  static register(env: Env): DynamicModule {
    return {
      module: PrismaModule,
      global: true,
      providers: [
        {
          provide: SYSTEM_PRISMA,
          useFactory: (): SystemPrisma =>
            new PrismaClient({
              datasources: { db: { url: env.ADMIN_DATABASE_URL } },
            }),
        },
        {
          provide: ADMIN_PRISMA,
          inject: [SYSTEM_PRISMA],
          useFactory: (system: PrismaClient): AdminPrisma => createAdminPrismaProxy(system),
        },
        {
          provide: APP_PRISMA,
          useFactory: (): AppPrisma =>
            new PrismaClient({
              datasources: { db: { url: env.DATABASE_URL } },
            }),
        },
        {
          provide: PRISMA,
          inject: [APP_PRISMA],
          useFactory: (app: PrismaClient) => createTenantPrismaProxy(app),
        },
        PrismaLifecycle,
        { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
      ],
      exports: [PRISMA, ADMIN_PRISMA, SYSTEM_PRISMA, APP_PRISMA],
    };
  }
}
