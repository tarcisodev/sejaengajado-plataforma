import { Prisma, type PrismaClient } from '@prisma/client';

import { requireTenantResellerId } from './tenant.context';
import { isScopedModel, NESTED_SCOPED_MODELS, type ScopedModel } from './scoped-models';

type Args = Record<string, unknown>;

function asArgs(value: unknown): Args {
  return value && typeof value === 'object' ? (value as Args) : {};
}

function modelToDelegate(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

function withResellerScope(model: string, resellerId: string, where: unknown): unknown {
  const nested = NESTED_SCOPED_MODELS[model as ScopedModel];
  if (nested) {
    const current = asArgs(where);
    const relation = asArgs(current[nested.relation]);
    return {
      ...current,
      [nested.relation]: {
        ...relation,
        resellerId,
      },
    };
  }
  return { ...asArgs(where), resellerId };
}

function withResellerData(model: string, resellerId: string, data: unknown): unknown {
  if (NESTED_SCOPED_MODELS[model as ScopedModel]) {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map((row) => ({ ...asArgs(row), resellerId }));
  }
  return { ...asArgs(data), resellerId };
}

function stripResellerId(data: unknown): unknown {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return data;
  }
  const next = { ...asArgs(data) };
  delete next.resellerId;
  return next;
}

function notFoundError(model: string): Error {
  return new Prisma.PrismaClientKnownRequestError(
    `No ${model} found for tenant scope`,
    { code: 'P2025', clientVersion: Prisma.prismaVersion.client },
  );
}

type TxClient = {
  $executeRaw: PrismaClient['$executeRaw'];
  [key: string]: unknown;
};

type TxDelegate = Record<string, (a?: unknown) => Promise<unknown>>;

async function withResellerRls<T>(
  client: {
    $transaction: (
      fn: (tx: TxClient) => Promise<T>,
      options?: { maxWait?: number; timeout?: number },
    ) => Promise<T>;
  },
  resellerId: string,
  fn: (tx: TxClient) => Promise<T>,
): Promise<T> {
  return client.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.reseller_id', ${resellerId}, true)`;
    return fn(tx);
  });
}

function delegateOf(tx: TxClient, model: string): TxDelegate {
  return tx[modelToDelegate(model)] as TxDelegate;
}

export function createTenantExtensionFor(resellerId: string) {
  return Prisma.defineExtension((client) =>
    client.$extends({
      name: 'tenant-scope',
      query: {
        $allModels: {
          async $allOperations({ model, operation, args }) {
            if (!model || !isScopedModel(model)) {
              return withResellerRls(
                client as unknown as Parameters<typeof withResellerRls>[0],
                resellerId,
                async (tx) => {
                  if (!model) {
                    throw new Error('Prisma operation missing model name');
                  }
                  return delegateOf(tx, model)[operation](args);
                },
              );
            }

            const next = { ...asArgs(args) };

            return withResellerRls(
              client as unknown as Parameters<typeof withResellerRls>[0],
              resellerId,
              async (tx) => {
              const delegate = delegateOf(tx, model);

              if (operation === 'findUnique') {
                return delegate.findFirst({
                  ...next,
                  where: withResellerScope(model, resellerId, next.where),
                });
              }

              if (operation === 'findUniqueOrThrow') {
                const row = (await delegate.findFirst({
                  ...next,
                  where: withResellerScope(model, resellerId, next.where),
                })) as Record<string, unknown> | null;
                if (!row) {
                  throw notFoundError(model);
                }
                return row;
              }

              if (
                operation === 'findFirst' ||
                operation === 'findFirstOrThrow' ||
                operation === 'findMany' ||
                operation === 'count' ||
                operation === 'aggregate' ||
                operation === 'groupBy'
              ) {
                return delegate[operation]({
                  ...next,
                  where: withResellerScope(model, resellerId, next.where),
                });
              }

              if (operation === 'create' || operation === 'createMany') {
                return delegate[operation]({
                  ...next,
                  data: withResellerData(model, resellerId, next.data),
                });
              }

              if (operation === 'update') {
                const existing = (await delegate.findFirst({
                  where: withResellerScope(model, resellerId, next.where),
                })) as Record<string, unknown> | null;
                if (!existing?.id) {
                  throw notFoundError(model);
                }
                return delegate.update({
                  ...next,
                  where: { id: existing.id },
                  data: stripResellerId(next.data),
                });
              }

              if (operation === 'updateMany') {
                return delegate.updateMany({
                  ...next,
                  where: withResellerScope(model, resellerId, next.where),
                  data: stripResellerId(next.data),
                });
              }

              if (operation === 'delete') {
                const existing = (await delegate.findFirst({
                  where: withResellerScope(model, resellerId, next.where),
                })) as Record<string, unknown> | null;
                if (!existing?.id) {
                  throw notFoundError(model);
                }
                return delegate.delete({
                  ...next,
                  where: { id: existing.id },
                });
              }

              if (operation === 'deleteMany') {
                return delegate.deleteMany({
                  ...next,
                  where: withResellerScope(model, resellerId, next.where),
                });
              }

              if (operation === 'upsert') {
                const existing = (await delegate.findFirst({
                  where: withResellerScope(model, resellerId, next.where),
                })) as Record<string, unknown> | null;
                if (existing?.id) {
                  return delegate.update({
                    where: { id: existing.id },
                    data: stripResellerId(next.update),
                  });
                }
                return delegate.create({
                  data: withResellerData(model, resellerId, next.create),
                });
              }

              return delegate[operation]({
                ...next,
                where: withResellerScope(model, resellerId, next.where),
              });
              },
            );
          },
        },
      },
    }),
  );
}

const MODEL_DELEGATES = new Set(
  Prisma.dmmf.datamodel.models.map(
    (model) => model.name.charAt(0).toLowerCase() + model.name.slice(1),
  ),
);

/**
 * Proxy that resolves the tenant synchronously on model access (before Prisma
 * thenables drop AsyncLocalStorage) and reuses a cached extended client.
 */
export function createTenantPrismaProxy(root: PrismaClient): PrismaClient {
  const cache = new Map<string, PrismaClient>();

  const scoped = (resellerId: string): PrismaClient => {
    const hit = cache.get(resellerId);
    if (hit) {
      return hit;
    }
    const client = root.$extends(
      createTenantExtensionFor(resellerId),
    ) as unknown as PrismaClient;
    cache.set(resellerId, client);
    return client;
  };

  return new Proxy(root, {
    get(target, prop) {
      if (typeof prop === 'symbol') {
        return Reflect.get(target, prop, target);
      }
      if (prop === 'then' || prop === 'toJSON') {
        return undefined;
      }
      if (typeof prop !== 'string' || !MODEL_DELEGATES.has(prop)) {
        if (prop === '$transaction') {
          const resellerId = requireTenantResellerId();
          const client = scoped(resellerId);
          const original = client.$transaction.bind(client);
          return ((
            arg: ((tx: TxClient) => Promise<unknown>) | unknown[],
            options?: unknown,
          ) => {
            if (typeof arg === 'function') {
              return original(async (tx: TxClient) => {
                await tx.$executeRaw`SELECT set_config('app.reseller_id', ${resellerId}, true)`;
                return arg(tx);
              }, options as never);
            }
            return original(arg as never, options as never);
          }) as PrismaClient['$transaction'];
        }
        const value = Reflect.get(target, prop, target);
        return typeof value === 'function' ? value.bind(target) : value;
      }
      const resellerId = requireTenantResellerId();
      return Reflect.get(scoped(resellerId), prop);
    },
  }) as PrismaClient;
}
