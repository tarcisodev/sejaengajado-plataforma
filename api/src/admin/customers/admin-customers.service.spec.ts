import { AdminCustomersService } from './admin-customers.service';

describe('AdminCustomersService', () => {
  it('lists customers with cursor pagination', async () => {
    const rows = [
      {
        id: 'c1',
        name: 'Ana',
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
      },
      {
        id: 'c2',
        name: 'Bia',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ];
    const db = {
      customer: {
        findMany: jest.fn().mockResolvedValue(rows),
      },
    };
    const service = new AdminCustomersService(db as never);
    const page = await service.list({ limit: 1 });
    expect(db.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 2 }),
    );
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.id).toBe('c1');
    expect(page.nextCursor).toBeTruthy();
  });
});
