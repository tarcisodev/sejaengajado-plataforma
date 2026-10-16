import { ConflictException } from '@nestjs/common';

import { CustomersService } from './customers.service';

describe('CustomersService invite', () => {
  const resellerId = '22222222-2222-4222-8222-222222222222';

  function setup() {
    const db = {
      reseller: {
        findUnique: jest.fn().mockResolvedValue({ status: 'ACTIVE' }),
      },
      user: {
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
          id: 'u1',
          ...data,
        })),
      },
      customer: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
          id: 'c1',
          resellerId,
          ...data,
        })),
      },
    };
    const supabaseAdmin = {
      inviteUserByEmail: jest.fn(async (email: string) => ({
        id: 'sb-1',
        email,
      })),
      generateRecoveryLink: jest.fn(async () => ({
        actionLink: 'https://auth.example/invite',
      })),
      unenrollMfaFactors: jest.fn(async () => ({ removed: 0 })),
    };
    const service = new CustomersService(db as never, supabaseAdmin as never);
    return { db, supabaseAdmin, service };
  }

  it('creates CRM-only customer without email', async () => {
    const { db, supabaseAdmin, service } = setup();
    await service.create(resellerId, { name: 'Loja', city: 'Uberaba' });
    expect(supabaseAdmin.inviteUserByEmail).not.toHaveBeenCalled();
    expect(db.customer.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: 'Loja', resellerId }),
    });
  });

  it('invites and links User CUSTOMER when email is provided', async () => {
    const { db, supabaseAdmin, service } = setup();
    const created = await service.create(resellerId, {
      name: 'Loja',
      email: 'loja@example.com',
      city: 'Uberaba',
    });
    expect(supabaseAdmin.inviteUserByEmail).toHaveBeenCalledWith('loja@example.com');
    expect(db.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        role: 'CUSTOMER',
        resellerId,
        email: 'loja@example.com',
      }),
    });
    expect(db.customer.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'loja@example.com',
        userId: 'u1',
      }),
      include: { user: true },
    });
    expect(created).toMatchObject({ inviteActionLink: 'https://auth.example/invite' });
  });

  it('rejects duplicate email', async () => {
    const { db, service } = setup();
    db.customer.findFirst.mockResolvedValue({ id: 'c0' });
    await expect(
      service.create(resellerId, { name: 'X', email: 'loja@example.com' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
