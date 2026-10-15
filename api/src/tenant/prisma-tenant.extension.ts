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

type Delegate = {
  findFirst: (a: unknown) => Promise<Record<string, unknown> | null>;
  create: (a: unknown) => Promise<Record<string, unknown>>;
  update: (a: unknown) => Promise<Record<string, unknown>>;
};

export function createTenantExtensionFor(resellerId: string) {
  return Prisma.defineExtension((client) =>
    client.$extends({
      name: 'tenant-scope',
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            if (!model || !isScopedModel(model)) {
              return query(args);
            }

            const delegate = (client as unknown as Record<string, Delegate>)[
              modelToDelegate(model)
            ];
            const next = { ...asArgs(args) };

            if (operation === 'findUnique') {
              return delegate.findFirst({
                ...next,
                where: withResellerScope(model, resellerId, next.where),
              });
            }

            if (operation === 'findUniqueOrThrow') {
              const row = await delegate.findFirst({
                ...next,
                where: withResellerScope(model, resellerId, next.where),
              });
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
              return query({
                ...next,
                where: withResellerScope(model, resellerId, next.where),
              } as typeof args);
            }

            if (operation === 'create' || operation === 'createMany') {
              return query({
                ...next,
                data: withResellerData(model, resellerId, next.data),
              } as typeof args);
            }

            if (operation === 'update') {
              const existing = await delegate.findFirst({
                where: withResellerScope(model, resellerId, next.where),
              });
              if (!existing?.id) {
                throw notFoundError(model);
              }
              return query({
                ...next,
                where: { id: existing.id },
                data: stripResellerId(next.data),
              } as typeof args);
            }

            if (operation === 'updateMany') {
              return query({
                ...next,
                where: withResellerScope(model, resellerId, next.where),
                data: stripResellerId(next.data),
              } as typeof args);
            }

            if (operation === 'delete') {
              const existing = await delegate.findFirst({
                where: withResellerScope(model, resellerId, next.where),
              });
              if (!existing?.id) {
                throw notFoundError(model);
              }
              return query({
                ...next,
                where: { id: existing.id },
              } as typeof args);
            }

            if (operation === 'deleteMany') {
              return query({
                ...next,
                where: withResellerScope(model, resellerId, next.where),
              } as typeof args);
            }

            if (operation === 'upsert') {
              const existing = await delegate.findFirst({
                where: withResellerScope(model, resellerId, next.where),
              });
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

            return query({
              ...next,
              where: withResellerScope(model, resellerId, next.where),
            } as typeof args);
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
          return client.$transaction.bind(client);
        }
        const value = Reflect.get(target, prop, target);
        return typeof value === 'function' ? value.bind(target) : value;
      }
      const resellerId = requireTenantResellerId();
      return Reflect.get(scoped(resellerId), prop);
    },
  }) as PrismaClient;
}
