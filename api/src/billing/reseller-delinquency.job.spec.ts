import { ResellerDelinquencyJob } from './reseller-delinquency.job';

describe('ResellerDelinquencyJob', () => {
  const resellerId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  function setup() {
    const db = {
      $queryRaw: jest.fn().mockResolvedValue([{ ok: true }]),
      $executeRaw: jest.fn().mockResolvedValue(undefined),
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          reseller: { update: jest.fn().mockResolvedValue({}) },
          lifecycleEvent: { create: jest.fn().mockResolvedValue({}) },
        }),
      ),
      platformConfig: {
        findUnique: jest.fn().mockResolvedValue({ resellerGraceDays: 30 }),
      },
      resellerInvoice: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'inv-1',
            period: '2026-01',
            resellerId,
            dueDate: new Date('2026-02-01T00:00:00.000Z'),
            reseller: { id: resellerId, status: 'ACTIVE', isPlatform: false },
          },
        ]),
        update: jest.fn().mockResolvedValue({}),
      },
      reseller: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      lifecycleEvent: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    return { db, job: new ResellerDelinquencyJob(db as never) };
  }

  it('marks overdue OPEN invoice → OVERDUE and reseller DELINQUENT', async () => {
    const { db, job } = setup();
    const now = new Date('2026-02-10T12:00:00.000Z');
    const result = await job.runOnce(now);
    expect(result.markedDelinquent).toBe(1);
    expect(db.resellerInvoice.update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: { status: 'OVERDUE' },
    });
    expect(db.$transaction).toHaveBeenCalled();
  });

  it('day 30 still not migration-eligible; day 31 is', async () => {
    const { db, job } = setup();
    db.resellerInvoice.findMany.mockResolvedValue([]);
    const delinquentSince = new Date('2026-01-01T00:00:00.000Z');
    db.reseller.findMany.mockResolvedValue([
      {
        id: resellerId,
        status: 'DELINQUENT',
        isPlatform: false,
        delinquentSince,
      },
    ]);

    // day 30 after delinquentSince
    const day30 = new Date('2026-01-31T12:00:00.000Z');
    await expect(job.runOnce(day30)).resolves.toMatchObject({
      migrationEligible: 0,
    });

    // day 31+
    const day31 = new Date('2026-02-01T12:00:00.000Z');
    await expect(job.runOnce(day31)).resolves.toMatchObject({
      migrationEligible: 1,
    });
  });
});
