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
import { createTenantPrismaProxy } from './prisma-tenant.extension';

export const PRISMA = Symbol('PRISMA');
export const ADMIN_PRISMA = Symbol('ADMIN_PRISMA');

export type AdminPrisma = PrismaClient;
export type TenantPrisma = PrismaClient;

@Injectable()
export class PrismaLifecycle implements OnModuleInit, OnModuleDestroy {
  constructor(
    @Inject(PRISMA)
    private readonly prisma: {
      $connect(): Promise<void>;
      $disconnect(): Promise<void>;
    },
    @Inject(ADMIN_PRISMA) private readonly adminPrisma: PrismaClient,
  ) {}

  async onModuleInit(): Promise<void> {
    await Promise.all([this.prisma.$connect(), this.adminPrisma.$connect()]);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.prisma.$disconnect(), this.adminPrisma.$disconnect()]);
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
          provide: ADMIN_PRISMA,
          useFactory: (): AdminPrisma =>
            new PrismaClient({
              datasources: { db: { url: env.ADMIN_DATABASE_URL } },
            }),
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
      exports: [PRISMA, ADMIN_PRISMA],
    };
  }
}
