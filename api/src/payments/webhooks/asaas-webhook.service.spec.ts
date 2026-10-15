import { UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { FakeGateway } from '../domain/fake-gateway';
import { AsaasWebhookService } from './asaas-webhook.service';
import { WebhookQueueService } from './webhook-queue.service';

describe('AsaasWebhookService', () => {
  const token = 'whsec_test_token';
  let db: {
    webhookEvent: {
      create: jest.Mock;
      updateMany: jest.Mock;
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      update: jest.Mock;
    };
    payment: { findUnique: jest.Mock; update: jest.Mock };
    resellerInvoice: { findUnique: jest.Mock; update: jest.Mock };
    ledgerEntry: { findFirst: jest.Mock };
    reseller: { findFirst: jest.Mock; updateMany: jest.Mock };
    site: { updateMany: jest.Mock };
  };
  let gateway: FakeGateway;
  let queue: WebhookQueueService;
  let ledger: { appendForReseller: jest.Mock };
  let service: AsaasWebhookService;

  beforeEach(() => {
    db = {
      webhookEvent: {
        create: jest.fn(),
        updateMany: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
      payment: { findUnique: jest.fn(), update: jest.fn() },
      resellerInvoice: { findUnique: jest.fn(), update: jest.fn() },
      ledgerEntry: { findFirst: jest.fn().mockResolvedValue(null) },
      reseller: {
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      site: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    gateway = new FakeGateway();
    queue = new WebhookQueueService();
    ledger = { appendForReseller: jest.fn().mockResolvedValue({ id: 'rev' }) };
    service = new AsaasWebhookService(
      { ASAAS_WEBHOOK_TOKEN: token } as never,
      db as never,
      gateway,
      queue,
      ledger as never,
    );
    // Bind only in process* tests — accept tests must not auto-pump the queue.
  });

  afterEach(() => {
    queue.onModuleDestroy();
  });

  function bindProcessor(): void {
    service.onModuleInit();
  }

  it('rejects invalid token without writing', async () => {
    await expect(service.accept('wrong', { id: 'evt1' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(db.webhookEvent.create).not.toHaveBeenCalled();
  });

  it('inserts event and enqueues on first delivery', async () => {
    db.webhookEvent.create.mockResolvedValue({ id: 'wh-1' });
    const enqueue = jest.spyOn(queue, 'enqueue');
    await expect(
      service.accept(token, {
        id: 'evt-1',
        event: 'PAYMENT_RECEIVED',
        payment: { id: 'pay_1', status: 'RECEIVED' },
      }),
    ).resolves.toEqual({ duplicate: false });
    expect(db.webhookEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        gateway: 'asaas',
        eventId: 'evt-1',
        payload: { event: 'PAYMENT_RECEIVED', paymentId: 'pay_1' },
      }),
    });
    expect(enqueue).toHaveBeenCalledWith('wh-1');
  });

  it('duplicate event returns 200 path without re-enqueue', async () => {
    db.webhookEvent.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    const enqueue = jest.spyOn(queue, 'enqueue');
    await expect(
      service.accept(token, {
        id: 'evt-dup',
        payment: { id: 'pay_1' },
      }),
    ).resolves.toEqual({ duplicate: true });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('concurrency on same event: only one insert wins', async () => {
    let creates = 0;
    db.webhookEvent.create.mockImplementation(async () => {
      creates += 1;
      if (creates === 1) {
        return { id: 'wh-a' };
      }
      throw new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: 'test',
      });
    });
    const enqueue = jest.spyOn(queue, 'enqueue');
    const body = { id: 'evt-race', payment: { id: 'pay_x' } };
    const [a, b] = await Promise.all([
      service.accept(token, body),
      service.accept(token, body),
    ]);
    expect([a.duplicate, b.duplicate].sort()).toEqual([false, true]);
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it('reconsulta wins over payload: PENDING remote does not mark PAID', async () => {
    bindProcessor();
    gateway.setPaymentStatus('pay_1', 'PENDING', 500);
    db.webhookEvent.updateMany.mockResolvedValue({ count: 1 });
    db.webhookEvent.findUniqueOrThrow.mockResolvedValue({
      id: 'wh-1',
      attempts: 1,
      payload: { paymentId: 'pay_1', event: 'PAYMENT_RECEIVED' },
    });
    db.payment.findUnique.mockResolvedValue({
      id: 'p-local',
      resellerId: 'r1',
      status: 'PENDING',
      amountCents: 500,
      gatewayPaymentId: 'pay_1',
    });
    db.webhookEvent.update.mockResolvedValue({});

    await expect(service.processEvent('wh-1')).resolves.toBe('PROCESSED');
    expect(db.payment.update).not.toHaveBeenCalled();
  });

  it('applies PAID from reconsulta CONFIRMED then ignores RECEIVED', async () => {
    bindProcessor();
    gateway.setPaymentStatus('pay_1', 'CONFIRMED', 500);
    db.webhookEvent.updateMany.mockResolvedValue({ count: 1 });
    db.webhookEvent.findUniqueOrThrow.mockResolvedValue({
      id: 'wh-1',
      attempts: 1,
      payload: { paymentId: 'pay_1' },
    });
    db.payment.findUnique.mockImplementation(async () => ({
      id: 'p-local',
      resellerId: 'r1',
      status: 'PENDING',
      amountCents: 500,
      gatewayPaymentId: 'pay_1',
      order: null,
    }));
    db.payment.update.mockResolvedValue({});
    db.resellerInvoice.findUnique.mockResolvedValue(null);
    db.webhookEvent.update.mockResolvedValue({});

    await expect(service.processEvent('wh-1')).resolves.toBe('PROCESSED');
    expect(db.payment.update).toHaveBeenCalledWith({
      where: { id: 'p-local' },
      data: expect.objectContaining({ status: 'PAID' }),
    });
    expect(ledger.appendForReseller).toHaveBeenCalled();

    // Second event (RECEIVED) after CONFIRMED — no regression / no update.
    gateway.setPaymentStatus('pay_1', 'RECEIVED', 500);
    db.webhookEvent.findUniqueOrThrow.mockResolvedValue({
      id: 'wh-2',
      attempts: 1,
      payload: { paymentId: 'pay_1' },
    });
    db.payment.findUnique.mockImplementation(async () => ({
      id: 'p-local',
      resellerId: 'r1',
      status: 'PAID',
      amountCents: 500,
      gatewayPaymentId: 'pay_1',
      order: null,
    }));
    db.payment.update.mockClear();
    await expect(service.processEvent('wh-2')).resolves.toBe('PROCESSED');
    expect(db.payment.update).not.toHaveBeenCalled();
  });

  it('concurrent process of same event claims once', async () => {
    bindProcessor();
    gateway.setPaymentStatus('pay_1', 'RECEIVED', 100);
    let claims = 0;
    db.webhookEvent.updateMany.mockImplementation(async () => {
      claims += 1;
      return { count: claims === 1 ? 1 : 0 };
    });
    db.webhookEvent.findUniqueOrThrow.mockResolvedValue({
      id: 'wh-1',
      attempts: 1,
      payload: { paymentId: 'pay_1' },
    });
    db.webhookEvent.findUnique.mockResolvedValue({ status: 'PROCESSING' });
    db.payment.findUnique.mockResolvedValue({
      id: 'p-local',
      resellerId: null,
      status: 'PENDING',
      amountCents: 100,
      gatewayPaymentId: 'pay_1',
    });
    db.payment.update.mockResolvedValue({});
    db.resellerInvoice.findUnique.mockResolvedValue(null);
    db.webhookEvent.update.mockResolvedValue({});

    const [a, b] = await Promise.all([
      service.processEvent('wh-1'),
      service.processEvent('wh-1'),
    ]);
    expect([a, b].filter((r) => r === 'PROCESSED')).toHaveLength(2);
    expect(db.payment.update).toHaveBeenCalledTimes(1);
  });

  it('marks INVALID_TRANSITION without changing payment', async () => {
    bindProcessor();
    gateway.setPaymentStatus('pay_1', 'PENDING', 500);
    db.webhookEvent.updateMany.mockResolvedValue({ count: 1 });
    db.webhookEvent.findUniqueOrThrow.mockResolvedValue({
      id: 'wh-1',
      attempts: 1,
      payload: { paymentId: 'pay_1' },
    });
    db.payment.findUnique.mockResolvedValue({
      id: 'p-local',
      resellerId: 'r1',
      status: 'PAID',
      amountCents: 500,
      gatewayPaymentId: 'pay_1',
    });
    db.webhookEvent.update.mockResolvedValue({});

    await expect(service.processEvent('wh-1')).resolves.toBe('PROCESSED');
    expect(db.payment.update).not.toHaveBeenCalled();
    expect(db.webhookEvent.update).toHaveBeenCalledWith({
      where: { id: 'wh-1' },
      data: expect.objectContaining({ lastError: 'INVALID_TRANSITION' }),
    });
  });

  it('chargeback/refund reverses ledger via append (not UPDATE) and invoice OVERDUE', async () => {
    bindProcessor();
    gateway.setPaymentStatus('pay_1', 'REFUNDED', 500);
    db.webhookEvent.updateMany.mockResolvedValue({ count: 1 });
    db.webhookEvent.findUniqueOrThrow.mockResolvedValue({
      id: 'wh-1',
      attempts: 1,
      payload: { paymentId: 'pay_1' },
    });
    db.payment.findUnique.mockResolvedValue({
      id: 'p-local',
      resellerId: 'r1',
      status: 'PAID',
      amountCents: 500,
      gatewayPaymentId: 'pay_1',
    });
    db.payment.update.mockResolvedValue({});
    db.ledgerEntry.findFirst
      .mockResolvedValueOnce({
        id: 'led-1',
        amountCents: 500,
        refType: 'Payment',
        refId: 'p-local',
      })
      .mockResolvedValueOnce(null);
    db.resellerInvoice.findUnique.mockResolvedValue({
      id: 'inv-1',
      status: 'PAID',
    });
    db.resellerInvoice.update.mockResolvedValue({});
    db.webhookEvent.update.mockResolvedValue({});

    await expect(service.processEvent('wh-1')).resolves.toBe('PROCESSED');
    expect(ledger.appendForReseller).toHaveBeenCalledWith(
      'r1',
      expect.objectContaining({
        type: 'IN',
        category: 'REVERSAL',
        reversalOfId: 'led-1',
      }),
    );
    expect(db.resellerInvoice.update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: { status: 'OVERDUE' },
    });
  });
});
