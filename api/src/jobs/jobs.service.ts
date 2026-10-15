import { Inject, Injectable, Logger } from '@nestjs/common';
import type { SiteStatus } from '@prisma/client';

import { ENV, type Env } from '../config/env';
import { spDayStartUtc } from '../common/sao-paulo-time';
import { SYSTEM_PRISMA, type SystemPrisma } from '../tenant/prisma.module';
import { JOB_MAILER, type JobMailer } from './mailer';
import { overdueDaysSp, targetStatusForDays } from './overdue-days';
import { monthsRemainingFidelity, plaquePenaltyCents } from './penalty';

const STATUS_RANK: Record<SiteStatus, number> = {
  DRAFT: 0,
  PUBLISHED: 1,
  READ_ONLY: 2,
  SUSPENDED: 3,
  ARCHIVED: 4,
};

const LOCK_KEY = 'jobs:lifecycle';

export interface JobsRunResult {
  scanned: number;
  transitioned: number;
  warned: number;
  renewals: number;
  skippedLock: boolean;
}

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @Inject(SYSTEM_PRISMA) private readonly db: SystemPrisma,
    @Inject(JOB_MAILER) private readonly mailer: JobMailer,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /**
   * Idempotent lifecycle pass: advisory lock, overdue bands, Pronto renewal
   * markers, optional Healthchecks.io heartbeat.
   */
  async runOnce(now = new Date()): Promise<JobsRunResult> {
    const locked = await this.db.$queryRaw<{ ok: boolean }[]>`
      SELECT pg_try_advisory_lock(hashtext(${LOCK_KEY})) AS ok
    `;
    if (!locked[0]?.ok) {
      return { scanned: 0, transitioned: 0, warned: 0, renewals: 0, skippedLock: true };
    }

    try {
      const result = await this.process(now);
      await this.heartbeat();
      return result;
    } finally {
      await this.db.$executeRaw`SELECT pg_advisory_unlock(hashtext(${LOCK_KEY}))`;
    }
  }

  private async process(now: Date): Promise<JobsRunResult> {
    const cfg = await this.db.platformConfig.findUnique({ where: { id: 'default' } });
    if (!cfg) {
      this.logger.warn('PlatformConfig ausente — job ignorado');
      return { scanned: 0, transitioned: 0, warned: 0, renewals: 0, skippedLock: false };
    }

    const sites = await this.db.site.findMany({
      where: {
        status: { in: ['PUBLISHED', 'READ_ONLY', 'SUSPENDED'] },
      },
      include: {
        plan: true,
        customer: true,
        subscriptions: {
          where: { status: { in: ['ACTIVE', 'PAST_DUE'] } },
          orderBy: { currentPeriodEnd: 'desc' },
          take: 1,
        },
      },
    });

    let transitioned = 0;
    let warned = 0;
    let renewals = 0;

    for (const site of sites) {
      const sub = site.subscriptions[0] ?? null;
      const periodEnd =
        sub?.currentPeriodEnd ??
        (site.plan.type === 'ONE_TIME' || site.plan.type === 'ANNUAL_HOSTING'
          ? site.hostingRenewsAt
          : null);
      if (!periodEnd) {
        continue;
      }

      if (
        (site.plan.type === 'ONE_TIME' || site.plan.type === 'ANNUAL_HOSTING') &&
        site.hostingRenewsAt &&
        site.hostingRenewsAt.getTime() <= now.getTime()
      ) {
        const marked = await this.ensureProntoRenewalMarker(site, now);
        if (marked) {
          renewals += 1;
        }
      }

      const days = overdueDaysSp(periodEnd, now);
      const target = targetStatusForDays(days, {
        warningDays: cfg.warningDays,
        readOnlyDays: cfg.readOnlyDays,
        suspendDays: cfg.suspendDays,
        archiveDays: cfg.archiveDays,
      });

      if (days >= 1 && sub && sub.status === 'ACTIVE') {
        await this.db.subscription.update({
          where: { id: sub.id },
          data: { status: 'PAST_DUE' },
        });
      }

      if (target === 'WARN') {
        const sent = await this.warnOnce(site, days, now);
        if (sent) {
          warned += 1;
        }
        continue;
      }

      if (!target) {
        continue;
      }

      const nextStatus = target as SiteStatus;
      if (STATUS_RANK[site.status] >= STATUS_RANK[nextStatus]) {
        continue;
      }

      const penalty =
        nextStatus === 'SUSPENDED' || nextStatus === 'ARCHIVED'
          ? this.computePenalty(site, cfg, now)
          : null;

      await this.db.$transaction(async (tx) => {
        await tx.site.update({
          where: { id: site.id },
          data: {
            status: nextStatus,
            editable: false,
          },
        });
        await tx.lifecycleEvent.create({
          data: {
            resellerId: site.resellerId,
            siteId: site.id,
            fromStatus: site.status,
            toStatus: nextStatus,
            reason: `OVERDUE_DAY_${days}`,
            penaltyCents: penalty,
          },
        });
      });
      site.status = nextStatus;
      transitioned += 1;
    }

    return {
      scanned: sites.length,
      transitioned,
      warned,
      renewals,
      skippedLock: false,
    };
  }

  private computePenalty(
    site: { plaqueFidelityEndsAt: Date | null },
    cfg: { plaqueValueCents: number; plaquePenaltyPct: number },
    now: Date,
  ): number | null {
    if (!site.plaqueFidelityEndsAt) {
      return null;
    }
    const months = monthsRemainingFidelity(now, site.plaqueFidelityEndsAt);
    return plaquePenaltyCents(cfg.plaqueValueCents, months, cfg.plaquePenaltyPct);
  }

  private async warnOnce(
    site: { id: string; resellerId: string; status: SiteStatus; slug: string },
    days: number,
    now: Date,
  ): Promise<boolean> {
    const localDay = spDayStartUtc(now).toISOString().slice(0, 10);
    const reason = `OVERDUE_WARN:${localDay}`;
    const existing = await this.db.lifecycleEvent.findFirst({
      where: { siteId: site.id, reason },
    });
    if (existing) {
      return false;
    }

    await this.db.lifecycleEvent.create({
      data: {
        resellerId: site.resellerId,
        siteId: site.id,
        fromStatus: site.status,
        toStatus: site.status,
        reason,
      },
    });

    await this.mailer.sendOverdueWarning({
      to: `site-${site.slug}@notify.invalid`,
      siteId: site.id,
      daysOverdue: days,
    });
    return true;
  }

  private async ensureProntoRenewalMarker(
    site: {
      id: string;
      resellerId: string;
      status: SiteStatus;
      hostingRenewsAt: Date | null;
    },
    now: Date,
  ): Promise<boolean> {
    if (!site.hostingRenewsAt) {
      return false;
    }
    const yearKey = site.hostingRenewsAt.toISOString().slice(0, 10);
    const reason = `PRONTO_RENEWAL_DUE:${yearKey}`;
    const existing = await this.db.lifecycleEvent.findFirst({
      where: { siteId: site.id, reason },
    });
    if (existing) {
      return false;
    }
    // Only mark once the renew day has arrived (period end day or after).
    if (spDayStartUtc(now).getTime() < spDayStartUtc(site.hostingRenewsAt).getTime()) {
      return false;
    }
    await this.db.lifecycleEvent.create({
      data: {
        resellerId: site.resellerId,
        siteId: site.id,
        fromStatus: site.status,
        toStatus: site.status,
        reason,
      },
    });
    return true;
  }

  private async heartbeat(): Promise<void> {
    const url = this.env.HC_JOBS_URL;
    if (!url) {
      return;
    }
    try {
      await fetch(url, { method: 'GET', signal: AbortSignal.timeout(5_000) });
    } catch (error) {
      this.logger.warn(`Heartbeat falhou: ${String(error)}`);
    }
  }
}
