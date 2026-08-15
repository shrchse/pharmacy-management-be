import { Request } from 'express';
import { Prisma, PrismaClient } from '../generated/prisma/client';
import { prisma } from './prisma';

type DbClient = PrismaClient | Prisma.TransactionClient;

type AuditInput = {
  tenantId: string;
  branchId?: string | null;
  actorId?: string | null;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'APPROVE' | 'REJECT' | 'EXPORT';
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
  req?: Request;
};

const toJsonValue = (value: unknown): Prisma.InputJsonValue | undefined => {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
};

export const auditLog = async (input: AuditInput, db: DbClient = prisma) => {
  return db.auditLog.create({
    data: {
      tenantId: input.tenantId,
      branchId: input.branchId ?? undefined,
      actorId: input.actorId ?? undefined,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? undefined,
      before: toJsonValue(input.before),
      after: toJsonValue(input.after),
      metadata: toJsonValue(input.metadata),
      ipAddress: input.req?.ip,
      userAgent: input.req?.headers['user-agent'],
    },
  });
};
