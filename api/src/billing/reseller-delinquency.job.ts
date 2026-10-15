import { Inject, Injectable, Logger } from '@nestjs/common';

import { SYSTEM_PRISMA, type SystemPrisma } from '../tenant/prisma.module';

const LOCK_KEY = 'billing:reseller-delinquency';

export interface DelinquencyRunResult {
  skippedLock: boolean;
  markedDelinquent: number;
  migrationEligible: number;
}

/**
 * Daily: OPEN invoices past dueDate → DELINQUENT.
 * After resellerGraceDays (default 30), counts as migration-eligible (lifecycle event).
 * Direct site overdue bands 7/8/16/60 remain in JobsService (B14) — not duplicated here.
 */
@Injectable()
export class ResellerDelinquencyJob {
  private readonly logger = new Logger(ResellerDelinquencyJob.name);

  constructor(@Inject(SYSTEM_PRISMA) private readonly db: SystemPrisma) {}

  async runOnce(now = new Date()): Promise<DelinquencyRunResult> {
    const locked = await this.db.$queryRaw<{ ok: boolean }[]>`
      SELECT pg_try_advisory_lock(hashtext(${LOCK_KEY})) AS ok
    `;
    if (!locked[0]?.ok) {
      return { skippedLock: true, markedDelinquent: 0, migrationEligible: 0 };
    }

    try {
      return await this.process(now);
    } finally {
      await this.db.$executeRaw`SELECT pg_advisory_unlock(hashtext(${LOCK_KEY}))`;
    }
  }

  private async process(now: Date): Promise<DelinquencyRunResult> {
    const cfg = await this.db.platformConfig.findUnique({ where: { id: 'default' } });
    const graceDays = cfg?.resellerGraceDays ?? 30;

    let markedDelinquent = 0;
    let migrationEligible = 0;

    const overdueInvoices = await this.db.resellerInvoice.findMany({
      where: {
        status: 'OPEN',
        dueDate: { lt: now },
      },
      include: { reseller: true },
    });

    for (const invoice of overdueInvoices) {
      if (invoice.reseller.isPlatform) {
        continue;
      }

      await this.db.resellerInvoice.update({
        where: { id: invoice.id },
        data: { status: 'OVERDUE' },
      });

      if (invoice.reseller.status === 'ACTIVE') {
        await this.db.$transaction(async (tx) => {
          await tx.reseller.update({
            where: { id: invoice.resellerId },
            data: { status: 'DELINQUENT', delinquentSince: now },
          });
          await tx.lifecycleEvent.create({
            data: {
              resellerId: invoice.resellerId,
              fromStatus: 'ACTIVE',
              toStatus: 'DELINQUENT',
              reason: `INVOICE_OVERDUE:${invoice.period}`,
            },
          });
        });
        markedDelinquent += 1;
      }
    }

    const delinquents = await this.db.reseller.findMany({
      where: {
        status: 'DELINQUENT',
        isPlatform: false,
        delinquentSince: { not: null },
      },
    });

    for (const reseller of delinquents) {
      if (!reseller.delinquentSince) {
        continue;
      }
      const graceEnd = new Date(
        reseller.delinquentSince.getTime() + graceDays * 24 * 60 * 60 * 1000,
      );
      // Day 30 still on air; day 31 → migration eligible
      if (now.getTime() < graceEnd.getTime() + 24 * 60 * 60 * 1000) {
        continue;
      }
      const reason = `MIGRATION_ELIGIBLE:${graceDays}`;
      const existing = await this.db.lifecycleEvent.findFirst({
        where: { resellerId: reseller.id, reason },
      });
      if (existing) {
        continue;
      }
      await this.db.lifecycleEvent.create({
        data: {
          resellerId: reseller.id,
          fromStatus: 'DELINQUENT',
          toStatus: 'DELINQUENT',
          reason,
        },
      });
      migrationEligible += 1;
      this.logger.warn(
        { resellerId: reseller.id },
        'revendedor elegível para migração após grace',
      );
    }

    return { skippedLock: false, markedDelinquent, migrationEligible };
  }
}
