import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { auditLog } from '../../lib/audit';
import { prisma } from '../../lib/prisma';
import { HttpError, sendSuccess } from '../../utils/apiResponse';
import { getBranchId, getTenantId } from '../../utils/scope';
import { assertSupervisorAuthorizations, consumeSupervisorAuthorizations } from '../../lib/supervisor';

const money = (value: number) => value.toFixed(2);

const idParamSchema = z.object({
  id: z.string().uuid(),
});

const cancelSchema = z.object({
  reason: z.string().min(1),
  supervisorAuthorizationIds: z.array(z.string().uuid()).default([]),
});

const transactionInclude = {
  saleItems: {
    include: {
      product: true,
      productUnit: { include: { unit: true } },
      batch: true,
    },
  },
  payments: true,
  customer: true,
  cashier: { select: { id: true, name: true, email: true } },
  cashierSession: true,
  branch: true,
  receivable: true,
} as const;

export const listTransactions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const status = z.enum(['DRAFT', 'COMPLETED', 'CANCELLED', 'REJECTED', 'RETURNED']).optional().parse(req.query.status);
    const transactions = await prisma.sale.findMany({
      where: {
        tenantId,
        branchId,
        status,
      },
      include: {
        payments: true,
        customer: true,
        cashier: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return sendSuccess(res, transactions, 'Transactions retrieved', 200, { count: transactions.length });
  } catch (error) {
    return next(error);
  }
};

export const getTransaction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const { id } = idParamSchema.parse(req.params);
    const transaction = await prisma.sale.findFirstOrThrow({
      where: { id, tenantId, branchId },
      include: transactionInclude,
    });

    return sendSuccess(res, transaction, 'Transaction retrieved');
  } catch (error) {
    return next(error);
  }
};

export const cancelTransaction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const { id } = idParamSchema.parse(req.params);
    const payload = cancelSchema.parse(req.body);
    const cancelled = await prisma.$transaction(async (tx) => {
      const before = await tx.sale.findFirstOrThrow({
        where: { id, tenantId, branchId },
        include: transactionInclude,
      });

      if (before.status === 'CANCELLED') {
        throw new HttpError('Transaction is already cancelled', 409, 'TRANSACTION_ALREADY_CANCELLED');
      }
      if (before.status !== 'COMPLETED') {
        throw new HttpError('Only completed transactions can be cancelled', 409, 'TRANSACTION_NOT_COMPLETED');
      }
      if (before.paymentStatus === 'PAID') {
        await assertSupervisorAuthorizations(tx, payload.supervisorAuthorizationIds, { tenantId, branchId, requestedById: req.auth!.userId, action: 'cancel_paid_trx' });
      }

      for (const item of before.saleItems) {
        if (!item.batchId) continue;
        const batch = await tx.productBatch.findFirstOrThrow({ where: { id: item.batchId, tenantId, branchId } });
        await tx.productBatch.update({
          where: { id: batch.id },
          data: { stock: { increment: item.baseQty } },
        });
        await tx.stockLedger.create({
          data: {
            tenantId,
            branchId,
            productId: item.productId,
            batchId: item.batchId,
            userId: req.auth?.userId,
            type: 'SALE_RETURN',
            qtyChange: item.baseQty,
            finalStock: batch.stock + item.baseQty,
            refType: 'SaleCancel',
            refId: before.id,
            sourceDocumentNo: before.invoiceNumber,
            notes: `Cancel transaction: ${payload.reason}`,
          },
        });
      }

      const paidAmount = Number(before.paidAmount);
      if (paidAmount > 0) {
        const cashAccount = await tx.cashAccount.findFirst({
          where: {
            tenantId,
            isActive: true,
            OR: [{ branchId }, { branchId: null }],
          },
          orderBy: [{ branchId: 'desc' }, { createdAt: 'asc' }],
        });

        if (cashAccount) {
          await tx.cashMutation.create({
            data: {
              tenantId,
              branchId,
              cashAccountId: cashAccount.id,
              type: 'CASH_OUT',
              amount: money(paidAmount),
              refType: 'SaleCancel',
              refId: before.id,
              notes: `Cancel/refund ${before.invoiceNumber}`,
              createdById: req.auth?.userId,
            },
          });
          await tx.cashAccount.update({
            where: { id: cashAccount.id },
            data: { balance: { decrement: paidAmount } },
          });
        }
      }

      if (before.receivable) {
        await tx.receivable.update({
          where: { id: before.receivable.id },
          data: { status: 'CANCELLED' },
        });
      }

      const updated = await tx.sale.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          paymentStatus: 'CANCELLED',
          cancelledAt: new Date(),
          cancelReason: payload.reason,
        },
        include: transactionInclude,
      });

      if (before.paymentStatus === 'PAID') {
        await consumeSupervisorAuthorizations(tx, payload.supervisorAuthorizationIds, { tenantId, branchId, requestedById: req.auth!.userId, action: 'cancel_paid_trx' });
      }

      await auditLog({ tenantId, branchId, actorId: req.auth?.userId, action: 'UPDATE', entity: 'Sale', entityId: id, before, after: updated, req }, tx);
      return updated;
    });

    return sendSuccess(res, cancelled, 'Transaction cancelled');
  } catch (error) {
    return next(error);
  }
};

export const getReceipt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const transactionId = z.string().uuid().parse(req.params.transactionId);
    const sale = await prisma.sale.findFirstOrThrow({
      where: { id: transactionId, tenantId, branchId },
      include: transactionInclude,
    });

    const receipt = {
      transactionId: sale.id,
      invoiceNumber: sale.invoiceNumber,
      issuedAt: sale.createdAt,
      branch: {
        name: sale.branch.name,
        address: sale.branch.address,
        phone: sale.branch.phone,
        siaNumber: sale.branch.siaNumber,
      },
      cashier: sale.cashier,
      customer: sale.customer,
      items: sale.saleItems.map((item) => ({
        productId: item.productId,
        productName: item.product.name,
        unit: item.productUnit.unit.name,
        batchNumber: item.batch?.batchNumber,
        qty: item.qty,
        unitPrice: item.unitPrice,
        discountAmount: item.discountAmount,
        subtotal: item.subtotal,
      })),
      totals: {
        totalAmount: sale.totalAmount,
        discountAmount: sale.discountAmount,
        taxAmount: sale.taxAmount,
        grandTotal: sale.grandTotal,
        paidAmount: sale.paidAmount,
        changeAmount: sale.changeAmount,
      },
      payments: sale.payments,
      status: sale.status,
    };

    return sendSuccess(res, receipt, 'Receipt retrieved');
  } catch (error) {
    return next(error);
  }
};
