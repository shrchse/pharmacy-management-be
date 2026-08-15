import crypto from 'crypto';
import { Request } from 'express';
import { Prisma } from '../generated/prisma/client';

export type IdempotencyRecord = {
  id: string;
  tenantId: string;
  branchId: string | null;
  key: string;
  requestHash: string;
  status: string;
  responseBody: unknown | null;
  statusCode: number | null;
};

export const getIdempotencyKey = (req: Request) => {
  const header = req.headers['idempotency-key'];
  return Array.isArray(header) ? header[0] : header;
};

export const hashRequestBody = (body: unknown) => {
  return crypto.createHash('sha256').update(JSON.stringify(body ?? {})).digest('hex');
};

export const findIdempotencyRecord = async (
  tx: Prisma.TransactionClient,
  tenantId: string,
  branchId: string | null,
  key: string
): Promise<IdempotencyRecord | null> =>
  tx.idempotencyKey.findFirst({
    where: {
      tenantId,
      branchId,
      key,
    },
  });

export const createIdempotencyRecord = async (
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    branchId?: string | null;
    userId?: string | null;
    key: string;
    requestHash: string;
  }
) => {
  await tx.idempotencyKey.create({
    data: {
      tenantId: input.tenantId,
      branchId: input.branchId ?? undefined,
      userId: input.userId ?? undefined,
      key: input.key,
      requestHash: input.requestHash,
      status: 'PROCESSING',
    },
  });
};

export const completeIdempotencyRecord = async (
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    branchId?: string | null;
    key: string;
    statusCode: number;
    responseBody: Prisma.InputJsonValue;
  }
) => {
  await tx.idempotencyKey.updateMany({
    where: {
      tenantId: input.tenantId,
      branchId: input.branchId ?? null,
      key: input.key,
    },
    data: {
      status: 'COMPLETED',
      statusCode: input.statusCode,
      responseBody: input.responseBody,
    },
  });
};
