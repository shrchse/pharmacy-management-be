import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { auditLog } from '../../lib/audit';
import { prisma } from '../../lib/prisma';
import { Prisma } from '../../generated/prisma/client';
import { HttpError, sendSuccess } from '../../utils/apiResponse';
import { getBranchId, getTenantId } from '../../utils/scope';

const money = (value: number) => value.toFixed(2);

const idParamSchema = z.object({
  id: z.string().uuid(),
});

const openShiftSchema = z.object({
  cashierId: z.string().uuid().optional(),
  startingCash: z.coerce.number().nonnegative(),
  notes: z.string().optional(),
});

const closeShiftSchema = z.object({
  actualCash: z.coerce.number().nonnegative(),
  notes: z.string().optional(),
});

const depositShiftSchema = z.object({
  depositAmount: z.coerce.number().nonnegative(),
  notes: z.string().optional(),
});

const verifyShiftSchema = z.object({
  approved: z.boolean().default(true),
  notes: z.string().optional(),
});

const expectedCashForSession = async (tx: Prisma.TransactionClient, sessionId: string, startingCash: number) => {
  const cashPayments = await tx.salePayment.aggregate({
    where: {
      method: 'CASH',
      sale: {
        sessionId,
        status: 'COMPLETED',
      },
    },
    _sum: {
      amount: true,
    },
  });

  return startingCash + Number(cashPayments._sum.amount ?? 0);
};

export const openShift = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const payload = openShiftSchema.parse(req.body);
    const cashierId = payload.cashierId ?? req.auth?.userId;
    if (!cashierId) throw new HttpError('cashierId is required', 400, 'CASHIER_REQUIRED');

    const shift = await prisma.$transaction(async (tx) => {
      const openCount = await tx.cashierSession.count({
        where: {
          tenantId,
          branchId,
          cashierId,
          closedAt: null,
          status: 'OPEN',
        },
      });

      if (openCount > 0) {
        throw new HttpError('Cashier already has an open shift in this branch', 409, 'SHIFT_ALREADY_OPEN');
      }

      const created = await tx.cashierSession.create({
        data: {
          tenantId,
          branchId,
          cashierId,
          startingCash: money(payload.startingCash),
          notes: payload.notes,
        },
        include: { cashier: { select: { id: true, name: true, email: true } }, branch: true },
      });

      await auditLog({ tenantId, branchId, actorId: req.auth?.userId, action: 'CREATE', entity: 'CashierSession', entityId: created.id, after: created, req }, tx);
      return created;
    });

    return sendSuccess(res, shift, 'Cashier shift opened', 201);
  } catch (error) {
    return next(error);
  }
};

export const getShift = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const { id } = idParamSchema.parse(req.params);
    const shift = await prisma.cashierSession.findFirstOrThrow({
      where: { id, tenantId, branchId },
      include: {
        cashier: { select: { id: true, name: true, email: true } },
        branch: true,
        sales: {
          include: { payments: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return sendSuccess(res, shift, 'Cashier shift retrieved');
  } catch (error) {
    return next(error);
  }
};

export const closeShift = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const { id } = idParamSchema.parse(req.params);
    const payload = closeShiftSchema.parse(req.body);

    const shift = await prisma.$transaction(async (tx) => {
      const before = await tx.cashierSession.findFirstOrThrow({
        where: { id, tenantId, branchId, status: 'OPEN', closedAt: null },
      });

      const expectedCash = await expectedCashForSession(tx, before.id, Number(before.startingCash));
      const difference = payload.actualCash - expectedCash;
      const closed = await tx.cashierSession.update({
        where: { id },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          expectedCash: money(expectedCash),
          actualCash: money(payload.actualCash),
          difference: money(difference),
          notes: payload.notes ?? before.notes,
        },
        include: { cashier: { select: { id: true, name: true, email: true } }, branch: true },
      });

      await auditLog({ tenantId, branchId, actorId: req.auth?.userId, action: 'UPDATE', entity: 'CashierSession', entityId: id, before, after: closed, req }, tx);
      return closed;
    });

    return sendSuccess(res, shift, 'Cashier shift closed');
  } catch (error) {
    return next(error);
  }
};

export const depositShift = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const { id } = idParamSchema.parse(req.params);
    const payload = depositShiftSchema.parse(req.body);
    const shift = await prisma.$transaction(async (tx) => {
      const before = await tx.cashierSession.findFirstOrThrow({
        where: { id, tenantId, branchId, status: { in: ['CLOSED', 'VERIFIED'] } },
      });
      const updated = await tx.cashierSession.update({
        where: { id },
        data: {
          status: before.status === 'VERIFIED' ? before.status : 'DEPOSITED',
          depositAmount: money(payload.depositAmount),
          depositedAt: new Date(),
          notes: payload.notes ?? before.notes,
        },
      });
      await auditLog({ tenantId, branchId, actorId: req.auth?.userId, action: 'UPDATE', entity: 'CashierSession', entityId: id, before, after: updated, req }, tx);
      return updated;
    });

    return sendSuccess(res, shift, 'Cashier shift deposit recorded');
  } catch (error) {
    return next(error);
  }
};

export const verifyShift = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const { id } = idParamSchema.parse(req.params);
    const payload = verifyShiftSchema.parse(req.body);
    const verifierId = req.auth?.userId;
    if (!verifierId) throw new HttpError('Authentication required', 401, 'UNAUTHENTICATED');

    const shift = await prisma.$transaction(async (tx) => {
      const before = await tx.cashierSession.findFirstOrThrow({
        where: { id, tenantId, branchId, status: { in: ['CLOSED', 'DEPOSITED'] } },
      });
      const updated = await tx.cashierSession.update({
        where: { id },
        data: {
          status: payload.approved ? 'VERIFIED' : 'REJECTED',
          verifiedById: verifierId,
          verifiedAt: new Date(),
          verificationNotes: payload.notes,
        },
      });
      await auditLog({ tenantId, branchId, actorId: verifierId, action: payload.approved ? 'APPROVE' : 'REJECT', entity: 'CashierSession', entityId: id, before, after: updated, req }, tx);
      return updated;
    });

    return sendSuccess(res, shift, 'Cashier shift verified');
  } catch (error) {
    return next(error);
  }
};
