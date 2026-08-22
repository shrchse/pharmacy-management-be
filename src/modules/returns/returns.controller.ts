import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { auditLog } from '../../lib/audit';
import { assertSupervisorAuthorizations, consumeSupervisorAuthorizations } from '../../lib/supervisor';
import { prisma } from '../../lib/prisma';
import { HttpError, sendSuccess } from '../../utils/apiResponse';
import { getBranchId, getTenantId } from '../../utils/scope';

const returnSchema = z.object({
  saleId: z.string().uuid(),
  returnNumber: z.string().trim().min(1).optional(),
  reason: z.string().trim().min(1),
  items: z.array(z.object({ saleItemId: z.string().uuid(), qty: z.number().int().positive() })).min(1),
  supervisorAuthorizationIds: z.array(z.string().uuid()).default([]),
});

const returnNumber = () => `SR-${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
const money = (value: number) => value.toFixed(2);

export const listSalesReturns = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const returns = await prisma.saleReturn.findMany({
      where: { tenantId },
      include: { sale: true, items: true, approvedBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return sendSuccess(res, returns, 'Sales returns retrieved', 200, { count: returns.length });
  } catch (error) { return next(error); }
};

export const createSalesReturn = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const actorId = req.auth?.userId;
    if (!actorId) throw new HttpError('Authentication required', 401, 'UNAUTHENTICATED');
    const payload = returnSchema.parse(req.body);
    const result = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findFirstOrThrow({ where: { id: payload.saleId, tenantId, branchId }, include: { saleItems: true, saleReturns: { include: { items: true } } } });
      if (sale.status === 'CANCELLED' || sale.status === 'REJECTED') throw new HttpError('Sale cannot be returned in its current status', 409, 'SALE_NOT_RETURNABLE');
      const saleItems = new Map(sale.saleItems.map((item) => [item.id, item]));
      const returnedByItem = new Map<string, number>();
      for (const previous of sale.saleReturns) for (const item of previous.items) returnedByItem.set(item.saleItemId, (returnedByItem.get(item.saleItemId) ?? 0) + item.qty);
      let overSell = false;
      let total = 0;
      const items: Array<{ tenantId: string; saleItemId: string; batchId: string | null; qty: number; refundAmount: string }> = [];
      for (const item of payload.items) {
        const saleItem = saleItems.get(item.saleItemId);
        if (!saleItem) throw new HttpError('Sale item does not belong to this sale', 400, 'SALE_ITEM_INVALID');
        const remaining = saleItem.qty - (returnedByItem.get(item.saleItemId) ?? 0);
        if (item.qty > remaining) overSell = true;
        const refund = item.qty * Number(saleItem.unitPrice);
        total += refund;
        items.push({ tenantId, saleItemId: saleItem.id, batchId: saleItem.batchId, qty: item.qty, refundAmount: money(refund) });
      }
      if (overSell) await assertSupervisorAuthorizations(tx, payload.supervisorAuthorizationIds, { tenantId, branchId, requestedById: actorId, action: 'return_over_sell' });

      for (const item of items) {
        if (!item.batchId) continue;
        const batch = await tx.productBatch.findFirstOrThrow({ where: { id: item.batchId, tenantId, branchId } });
        const updated = await tx.productBatch.update({ where: { id: batch.id }, data: { stock: { increment: item.qty } } });
        await tx.stockLedger.create({ data: { tenantId, branchId, productId: saleItems.get(item.saleItemId)!.productId, batchId: batch.id, userId: actorId, type: 'SALE_RETURN', qtyChange: item.qty, finalStock: updated.stock, refType: 'SaleReturn', sourceDocumentNo: payload.returnNumber, notes: payload.reason } });
      }

      const created = await tx.saleReturn.create({ data: { tenantId, saleId: sale.id, returnNumber: payload.returnNumber ?? returnNumber(), reason: payload.reason, refundTotal: money(total), approvedById: actorId, items: { create: items } }, include: { items: true } });
      if (total > 0 && Number(sale.paidAmount) > 0) {
        const account = await tx.cashAccount.findFirst({ where: { tenantId, branchId, isActive: true }, orderBy: { createdAt: 'asc' } });
        if (account) {
          await tx.cashMutation.create({ data: { tenantId, branchId, cashAccountId: account.id, type: 'CASH_OUT', amount: money(Math.min(total, Number(sale.paidAmount))), refType: 'SaleReturn', refId: created.id, notes: `Refund ${created.returnNumber}`, createdById: actorId } });
          await tx.cashAccount.update({ where: { id: account.id }, data: { balance: { decrement: Math.min(total, Number(sale.paidAmount)) } } });
        }
      }
      if (overSell) await consumeSupervisorAuthorizations(tx, payload.supervisorAuthorizationIds, { tenantId, branchId, requestedById: actorId, action: 'return_over_sell' });
      const updatedSale = await tx.sale.update({ where: { id: sale.id }, data: { status: 'RETURNED' } });
      await auditLog({ tenantId, branchId, actorId, action: 'CREATE', entity: 'SaleReturn', entityId: created.id, before: sale, after: { return: created, sale: updatedSale }, req }, tx);
      return { ...created, sale: updatedSale };
    });
    return sendSuccess(res, result, 'Sales return created', 201);
  } catch (error) { return next(error); }
};
