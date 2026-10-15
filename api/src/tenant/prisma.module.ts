import {
  Global,
  Inject,
  Injectable,
  Module,
  OnModuleDestroy,
  OnModuleInit,
  type DynamicModule,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

import type { Env } from '../config/env';
import { createAdminPrismaProxy } from './admin-prisma.proxy';
import { createTenantPrismaProxy } from './prisma-tenant.extension';

export const PRISMA = Symbol('PRISMA');
export const ADMIN_PRISMA = Symbol('ADMIN_PRISMA');
/** Ungated se_admin client — only for auth bootstrap (JWT user lookup). */
export const SYSTEM_PRISMA = Symbol('SYSTEM_PRISMA');

export type AdminPrisma = PrismaClient;
export type TenantPrisma = PrismaClient;
export type SystemPrisma = PrismaClient;

@Injectable()
export class PrismaLifecycle implements OnModuleInit, OnModuleDestroy {
  constructor(
    @Inject(PRISMA)
    private readonly prisma: {
      $connect(): Promise<void>;
      $disconnect(): Promise<void>;
    },
    @Inject(SYSTEM_PRISMA) private readonly systemPrisma: PrismaClient,
  ) {}

  async onModuleInit(): Promise<void> {
    await Promise.all([this.prisma.$connect(), this.systemPrisma.$connect()]);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.prisma.$disconnect(), this.systemPrisma.$disconnect()]);
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
          provide: PRISMA,
          useFactory: () => {
            const app = new PrismaClient({
              datasources: { db: { url: env.DATABASE_URL } },
            });
            return createTenantPrismaProxy(app);
          },
        },
        PrismaLifecycle,
      ],
      exports: [PRISMA, ADMIN_PRISMA, SYSTEM_PRISMA],
    };
  }
}
