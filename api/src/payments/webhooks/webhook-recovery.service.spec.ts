import { STUCK_PROCESSING_MS, WebhookRecoveryService } from './webhook-recovery.service';
import { WEBHOOK_MAX_ATTEMPTS } from './asaas-webhook.service';

describe('WebhookRecoveryService', () => {
  function setup() {
    const db = {
      $queryRaw: jest.fn().mockResolvedValue([{ ok: true }]),
      $executeRaw: jest.fn().mockResolvedValue(undefined),
      webhookEvent: {
        findMany: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const queue = { enqueue: jest.fn() };
    const service = new WebhookRecoveryService(db as never, queue as never);
    return { db, queue, service };
  }

  it('skips when lock is held', async () => {
    const { db, service } = setup();
    db.$queryRaw.mockResolvedValue([{ ok: false }]);
    await expect(service.recoverOnce()).resolves.toMatchObject({ skippedLock: true });
  });

  it('requeues PROCESSING stuck > 5 min (restart simulation)', async () => {
    const { db, queue, service } = setup();
    const now = new Date('2026-10-15T12:00:00.000Z');
    const stuckAt = new Date(now.getTime() - STUCK_PROCESSING_MS - 1);

    db.webhookEvent.findMany
      .mockResolvedValueOnce([
        {
          id: 'wh-stuck',
          eventId: 'evt-1',
          status: 'PROCESSING',
          updatedAt: stuckAt,
          attempts: 1,
        },
      ])
      .mockResolvedValueOnce([]) // retryable FAILED
      .mockResolvedValueOnce([]); // exhausted

    const result = await service.recoverOnce(now);
    expect(result.requeuedStuck).toBe(1);
    expect(db.webhookEvent.updateMany).toHaveBeenCalledWith({
      where: { id: 'wh-stuck', status: 'PROCESSING' },
      data: expect.objectContaining({ status: 'RECEIVED' }),
    });
    expect(queue.enqueue).toHaveBeenCalledWith('wh-stuck');
  });

  it('requeues FAILED below max attempts', async () => {
    const { db, queue, service } = setup();
    db.webhookEvent.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'wh-fail',
          eventId: 'evt-2',
          status: 'FAILED',
          attempts: WEBHOOK_MAX_ATTEMPTS - 1,
          processedAt: null,
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await service.recoverOnce();
    expect(result.requeuedFailed).toBe(1);
    expect(queue.enqueue).toHaveBeenCalledWith('wh-fail');
  });

  it('marks exhausted FAILED and increments alert counter', async () => {
    const { db, queue, service } = setup();
    db.webhookEvent.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'wh-dead',
          eventId: 'evt-3',
          status: 'FAILED',
          attempts: WEBHOOK_MAX_ATTEMPTS,
          lastError: 'boom',
          processedAt: null,
        },
      ]);

    const result = await service.recoverOnce(new Date());
    expect(result.markedExhausted).toBe(1);
    expect(service.exhaustedAlertCount).toBe(1);
    expect(queue.enqueue).not.toHaveBeenCalled();
    expect(db.webhookEvent.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: 'wh-dead' }),
      data: expect.objectContaining({
        lastError: expect.stringMatching(/^EXHAUSTED:/),
      }),
    });
  });
});
