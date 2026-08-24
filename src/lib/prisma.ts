import { PrismaPg } from '@prisma/adapter-pg';
import { AsyncLocalStorage } from 'async_hooks';
import { env } from '../config/env';
import { Prisma, PrismaClient } from '../generated/prisma/client';

type PrismaTransactionClient = Prisma.TransactionClient;
type PrismaClientLike = PrismaClient | PrismaTransactionClient;
type PrismaRequestContext = {
  tenantId?: string;
  branchId?: string | null;
  db?: PrismaTransactionClient;
};

const globalForPrisma = global as unknown as { basePrisma: PrismaClient };

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
});

const basePrisma =
  globalForPrisma.basePrisma ||
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.basePrisma = basePrisma;

export const prismaContext = new AsyncLocalStorage<PrismaRequestContext>();

const setRlsContext = async (db: PrismaTransactionClient, context: PrismaRequestContext) => {
  if (!context.tenantId) return;

  await db.$executeRaw`SELECT set_config('app.tenant_id', ${context.tenantId}, true)`;
  await db.$executeRaw`SELECT set_config('app.branch_id', ${context.branchId ?? ''}, true)`;
};

const runModelOperation = async <T>(
  modelName: string | symbol,
  operationName: string | symbol,
  args: unknown[],
  operation: (...args: unknown[]) => Promise<T>
) => {
  const context = prismaContext.getStore();
  if (!context?.tenantId || context.db) {
    return operation(...args);
  }

  return basePrisma.$transaction(async (tx) => {
    await setRlsContext(tx, context);
    const txModel = (tx as unknown as Record<string | symbol, unknown>)[modelName] as Record<string | symbol, unknown>;
    const txOperation = txModel?.[operationName];
    if (typeof txOperation !== 'function') {
      return operation(...args);
    }
    return (txOperation as (...innerArgs: unknown[]) => Promise<T>).apply(txModel, args);
  });
};

const delegateProxy = (modelName: string | symbol, delegate: unknown) => {
  if (!delegate || typeof delegate !== 'object') return delegate;

  return new Proxy(delegate as Record<string | symbol, unknown>, {
    get(target, operationName, receiver) {
      const value = Reflect.get(target, operationName, receiver);
      if (typeof value !== 'function') {
        return value;
      }

      return (...args: unknown[]) => runModelOperation(modelName, operationName, args, value.bind(target) as (...innerArgs: unknown[]) => Promise<unknown>);
    },
  });
};

const transactionProxy = async (arg: unknown, options?: unknown) => {
  const context = prismaContext.getStore();

  if (typeof arg === 'function') {
    if (context?.db) {
      return (arg as (tx: PrismaTransactionClient) => Promise<unknown>)(context.db);
    }

    return basePrisma.$transaction(async (tx) => {
      await setRlsContext(tx, context ?? {});
      return prismaContext.run({ ...context, db: tx }, () => (arg as (innerTx: PrismaTransactionClient) => Promise<unknown>)(tx));
    }, options as Parameters<PrismaClient['$transaction']>[1]);
  }

  return basePrisma.$transaction(arg as Parameters<PrismaClient['$transaction']>[0], options as Parameters<PrismaClient['$transaction']>[1]);
};

export const runWithPrismaContext = <T>(context: Omit<PrismaRequestContext, 'db'>, callback: () => T) => {
  return prismaContext.run(context, callback);
};

export const prisma = new Proxy(basePrisma, {
  get(target, property, receiver) {
    if (property === '$transaction') {
      return transactionProxy;
    }

    const context = prismaContext.getStore();
    const client: PrismaClientLike = context?.db ?? target;
    const value = Reflect.get(client, property, receiver);

    if (context?.db) {
      return typeof value === 'function' ? value.bind(client) : value;
    }

    if (typeof value === 'function') {
      return value.bind(target);
    }

    return context?.tenantId ? delegateProxy(property, value) : value;
  },
}) as PrismaClient;
