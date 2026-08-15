import { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { auditLog } from '../../lib/audit';
import { prisma } from '../../lib/prisma';
import { HttpError, sendSuccess } from '../../utils/apiResponse';
import { getBranchId, getTenantId } from '../../utils/scope';

const money = (value: number) => value.toFixed(2);

const idParamSchema = z.object({
  id: z.string().uuid(),
});

const setApjPinSchema = z.object({
  pin: z.string().min(4).max(12),
});

const purchaseOrderSchema = z.object({
  supplierId: z.string().uuid(),
  poNumber: z.string().min(1).optional(),
  invoiceNo: z.string().optional(),
  dueDate: z.coerce.date().optional(),
  discountAmount: z.coerce.number().nonnegative().default(0),
  taxAmount: z.coerce.number().nonnegative().default(0),
  items: z.array(z.object({
    productId: z.string().uuid(),
    productUnitId: z.string().uuid(),
    qty: z.number().int().positive(),
    buyPrice: z.coerce.number().nonnegative(),
  })).min(1),
});

const approvalSchema = z.object({
  notes: z.string().optional(),
});

const approveApjSchema = z.object({
  pin: z.string().min(4).max(12),
  notes: z.string().optional(),
});

const receiveSchema = z.object({
  invoiceNo: z.string().min(1),
  dueDate: z.coerce.date().optional(),
  items: z.array(z.object({
    purchaseItemId: z.string().uuid(),
    receivedQty: z.number().int().positive(),
    batchNumber: z.string().min(1),
    expiredDate: z.coerce.date(),
    locationId: z.string().uuid().optional(),
  })).min(1),
});

const purchaseReturnSchema = z.object({
  purchaseId: z.string().uuid(),
  returnNumber: z.string().min(1),
  reason: z.string().min(1),
  items: z.array(z.object({
    purchaseItemId: z.string().uuid(),
    batchId: z.string().uuid(),
    qty: z.number().int().positive(),
  })).min(1),
});

const poNumber = () => {
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PO-${stamp}-${suffix}`;
};

const purchaseInclude = {
  supplier: true,
  staff: { select: { id: true, name: true, email: true } },
  branch: true,
  purchaseItems: { include: { product: true, productUnit: { include: { unit: true } }, batch: true } },
  debt: true,
  returns: true,
} as const;

export const setApjPin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.auth?.userId;
    if (!userId) throw new HttpError('Authentication required', 401, 'UNAUTHENTICATED');
    const payload = setApjPinSchema.parse(req.body);
    const apjPinHash = await bcrypt.hash(payload.pin, 12);
    const user = await prisma.user.update({
      where: { id: userId },
      data: { apjPinHash },
      select: { id: true, name: true, email: true, sipaNumber: true },
    });

    await auditLog({ tenantId, actorId: userId, action: 'UPDATE', entity: 'UserApjPin', entityId: userId, metadata: { configured: true }, req });
    return sendSuccess(res, user, 'APJ PIN configured');
  } catch (error) {
    return next(error);
  }
};

export const listPurchaseOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const status = z.enum(['DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED']).optional().parse(req.query.status);
    const purchases = await prisma.purchase.findMany({
      where: { tenantId, branchId, status },
      include: purchaseInclude,
      orderBy: { createdAt: 'desc' },
    });

    return sendSuccess(res, purchases, 'Purchase orders retrieved', 200, { count: purchases.length });
  } catch (error) {
    return next(error);
  }
};

export const getPurchaseOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const { id } = idParamSchema.parse(req.params);
    const purchase = await prisma.purchase.findFirstOrThrow({
      where: { id, tenantId, branchId },
      include: purchaseInclude,
    });

    const approvals = await prisma.purchaseApproval.findMany({
      where: { tenantId, branchId, purchaseId: id },
      orderBy: { createdAt: 'desc' },
    });

    return sendSuccess(res, { ...purchase, approvals }, 'Purchase order retrieved');
  } catch (error) {
    return next(error);
  }
};

export const createPurchaseOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const staffId = req.auth?.userId;
    if (!staffId) throw new HttpError('Authentication required', 401, 'UNAUTHENTICATED');
    const payload = purchaseOrderSchema.parse(req.body);

    const purchase = await prisma.$transaction(async (tx) => {
      const productUnits = await tx.productUnit.findMany({
        where: { id: { in: payload.items.map((item) => item.productUnitId) } },
      });
      const unitById = new Map(productUnits.map((unit) => [unit.id, unit]));
      let totalAmount = 0;
      const items = payload.items.map((item) => {
        const productUnit = unitById.get(item.productUnitId);
        if (!productUnit || productUnit.productId !== item.productId) {
          throw new HttpError(`Product unit does not match product: ${item.productUnitId}`, 400, 'PRODUCT_UNIT_MISMATCH');
        }
        const baseQty = item.qty * productUnit.conversion;
        const subtotal = item.qty * item.buyPrice;
        totalAmount += subtotal;
        return {
          tenantId,
          productId: item.productId,
          productUnitId: item.productUnitId,
          qty: item.qty,
          baseQty,
          buyPrice: money(item.buyPrice),
          subtotal: money(subtotal),
        };
      });

      const grandTotal = totalAmount - payload.discountAmount + payload.taxAmount;
      const created = await tx.purchase.create({
        data: {
          tenantId,
          branchId,
          supplierId: payload.supplierId,
          staffId,
          poNumber: payload.poNumber ?? poNumber(),
          invoiceNo: payload.invoiceNo,
          dueDate: payload.dueDate,
          totalAmount: money(totalAmount),
          discountAmount: money(payload.discountAmount),
          taxAmount: money(payload.taxAmount),
          grandTotal: money(grandTotal),
          purchaseItems: { create: items },
        },
        include: purchaseInclude,
      });

      await auditLog({ tenantId, branchId, actorId: staffId, action: 'CREATE', entity: 'Purchase', entityId: created.id, after: created, req }, tx);
      return created;
    });

    return sendSuccess(res, purchase, 'Purchase order created', 201);
  } catch (error) {
    return next(error);
  }
};

export const submitApproval = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const requestedById = req.auth?.userId;
    if (!requestedById) throw new HttpError('Authentication required', 401, 'UNAUTHENTICATED');
    const { id } = idParamSchema.parse(req.params);
    const payload = approvalSchema.parse(req.body);

    const approval = await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findFirstOrThrow({ where: { id, tenantId, branchId, status: 'DRAFT' } });
      const created = await tx.purchaseApproval.create({
        data: {
          tenantId,
          branchId,
          purchaseId: purchase.id,
          requestedById,
          notes: payload.notes,
        },
      });
      await auditLog({ tenantId, branchId, actorId: requestedById, action: 'CREATE', entity: 'PurchaseApproval', entityId: created.id, after: created, req }, tx);
      return created;
    });

    return sendSuccess(res, approval, 'Purchase order submitted for APJ approval', 201);
  } catch (error) {
    return next(error);
  }
};

export const approveApj = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const approverId = req.auth?.userId;
    if (!approverId) throw new HttpError('Authentication required', 401, 'UNAUTHENTICATED');
    const { id } = idParamSchema.parse(req.params);
    const payload = approveApjSchema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      const approver = await tx.user.findFirstOrThrow({ where: { id: approverId, tenantId, status: 'ACTIVE' } });
      if (!approver.apjPinHash) throw new HttpError('APJ PIN is not configured for this user', 409, 'APJ_PIN_NOT_CONFIGURED');
      const validPin = await bcrypt.compare(payload.pin, approver.apjPinHash);
      if (!validPin) throw new HttpError('Invalid APJ PIN', 403, 'INVALID_APJ_PIN');

      const approval = await tx.purchaseApproval.findFirst({
        where: { tenantId, branchId, purchaseId: id, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
      });
      if (!approval) throw new HttpError('Pending purchase approval not found', 404, 'PURCHASE_APPROVAL_NOT_FOUND');

      const updatedApproval = await tx.purchaseApproval.update({
        where: { id: approval.id },
        data: { status: 'APPROVED', approverId, approvedAt: new Date(), notes: payload.notes ?? approval.notes },
      });
      const purchase = await tx.purchase.update({
        where: { id },
        data: { status: 'ORDERED' },
        include: purchaseInclude,
      });

      await auditLog({ tenantId, branchId, actorId: approverId, action: 'APPROVE', entity: 'Purchase', entityId: id, after: { purchase, approval: updatedApproval }, req }, tx);
      return { purchase, approval: updatedApproval };
    });

    return sendSuccess(res, result, 'Purchase order approved by APJ');
  } catch (error) {
    return next(error);
  }
};

export const receivePurchaseOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const { id } = idParamSchema.parse(req.params);
    const payload = receiveSchema.parse(req.body);
    const actorId = req.auth?.userId;

    const result = await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findFirstOrThrow({
        where: { id, tenantId, branchId, status: { in: ['ORDERED', 'PARTIALLY_RECEIVED'] } },
        include: { purchaseItems: true },
      });
      const itemById = new Map(purchase.purchaseItems.map((item) => [item.id, item]));

      for (const item of payload.items) {
        const purchaseItem = itemById.get(item.purchaseItemId);
        if (!purchaseItem) throw new HttpError(`Purchase item not found: ${item.purchaseItemId}`, 404, 'PURCHASE_ITEM_NOT_FOUND');
        const remaining = purchaseItem.qty - purchaseItem.receivedQty;
        if (item.receivedQty > remaining) {
          throw new HttpError('Received quantity exceeds remaining PO quantity', 409, 'RECEIVE_QTY_EXCEEDED', { remaining });
        }

        const batch = await tx.productBatch.create({
          data: {
            tenantId,
            branchId,
            productId: purchaseItem.productId,
            locationId: item.locationId,
            batchNumber: item.batchNumber,
            expiredDate: item.expiredDate,
            buyPrice: purchaseItem.buyPrice,
            stock: item.receivedQty * purchaseItem.baseQty / purchaseItem.qty,
          },
        });

        const baseReceivedQty = item.receivedQty * purchaseItem.baseQty / purchaseItem.qty;
        await tx.purchaseItem.update({
          where: { id: purchaseItem.id },
          data: {
            receivedQty: { increment: item.receivedQty },
            batchId: batch.id,
          },
        });
        await tx.stockLedger.create({
          data: {
            tenantId,
            branchId,
            productId: purchaseItem.productId,
            batchId: batch.id,
            locationId: item.locationId,
            userId: actorId,
            type: 'PURCHASE',
            qtyChange: baseReceivedQty,
            finalStock: baseReceivedQty,
            refType: 'Purchase',
            refId: purchase.id,
            sourceDocumentNo: payload.invoiceNo,
            notes: `Receiving PO ${purchase.poNumber}`,
          },
        });
      }

      const updatedItems = await tx.purchaseItem.findMany({ where: { tenantId, purchaseId: purchase.id } });
      const allReceived = updatedItems.every((item) => item.receivedQty >= item.qty);
      const updatedPurchase = await tx.purchase.update({
        where: { id: purchase.id },
        data: {
          invoiceNo: payload.invoiceNo,
          dueDate: payload.dueDate,
          status: allReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED',
          receivedAt: allReceived ? new Date() : purchase.receivedAt,
        },
        include: purchaseInclude,
      });

      const existingDebt = await tx.debt.findFirst({ where: { tenantId, branchId, purchaseId: purchase.id } });
      const debt = existingDebt
        ? existingDebt
        : await tx.debt.create({
            data: {
              tenantId,
              branchId,
              supplierId: purchase.supplierId,
              purchaseId: purchase.id,
              invoiceNo: payload.invoiceNo,
              amount: purchase.grandTotal,
              paidAmount: money(0),
              status: 'UNPAID',
              dueDate: payload.dueDate,
            },
          });

      await auditLog({ tenantId, branchId, actorId, action: 'UPDATE', entity: 'Purchase', entityId: purchase.id, before: purchase, after: { purchase: updatedPurchase, debt }, req }, tx);
      return { purchase: updatedPurchase, debt };
    });

    return sendSuccess(res, result, 'Purchase order received');
  } catch (error) {
    return next(error);
  }
};

export const listInvoices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const invoices = await prisma.purchase.findMany({
      where: { tenantId, branchId, invoiceNo: { not: null } },
      include: purchaseInclude,
      orderBy: { receivedAt: 'desc' },
    });

    return sendSuccess(res, invoices, 'Purchase invoices retrieved', 200, { count: invoices.length });
  } catch (error) {
    return next(error);
  }
};

export const listPurchaseReturns = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const returns = await prisma.purchaseReturn.findMany({
      where: { tenantId },
      include: { purchase: true, items: true, approvedBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return sendSuccess(res, returns, 'Purchase returns retrieved', 200, { count: returns.length });
  } catch (error) {
    return next(error);
  }
};

export const createPurchaseReturn = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const actorId = req.auth?.userId;
    const payload = purchaseReturnSchema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findFirstOrThrow({ where: { id: payload.purchaseId, tenantId, branchId }, include: { debt: true } });
      let totalAmount = 0;
      const items = [];

      for (const item of payload.items) {
        const purchaseItem = await tx.purchaseItem.findFirstOrThrow({ where: { id: item.purchaseItemId, tenantId, purchaseId: purchase.id } });
        const batch = await tx.productBatch.findFirstOrThrow({ where: { id: item.batchId, tenantId, branchId } });
        if (batch.stock < item.qty) throw new HttpError('Return quantity exceeds current batch stock', 409, 'RETURN_QTY_EXCEEDED');
        const amount = item.qty * Number(purchaseItem.buyPrice);
        totalAmount += amount;
        await tx.productBatch.update({ where: { id: batch.id }, data: { stock: { decrement: item.qty } } });
        await tx.stockLedger.create({
          data: {
            tenantId,
            branchId,
            productId: purchaseItem.productId,
            batchId: batch.id,
            userId: actorId,
            type: 'PURCHASE_RETURN',
            qtyChange: -item.qty,
            finalStock: batch.stock - item.qty,
            refType: 'PurchaseReturn',
            sourceDocumentNo: payload.returnNumber,
            notes: payload.reason,
          },
        });
        items.push({
          tenantId,
          purchaseItemId: purchaseItem.id,
          batchId: batch.id,
          qty: item.qty,
          amount: money(amount),
        });
      }

      const purchaseReturn = await tx.purchaseReturn.create({
        data: {
          tenantId,
          purchaseId: purchase.id,
          returnNumber: payload.returnNumber,
          status: 'COMPLETED',
          reason: payload.reason,
          totalAmount: money(totalAmount),
          approvedById: actorId,
          items: { create: items },
        },
        include: { items: true },
      });

      if (purchase.debt) {
        const nextAmount = Math.max(0, Number(purchase.debt.amount) - totalAmount);
        await tx.debt.update({
          where: { id: purchase.debt.id },
          data: {
            amount: money(nextAmount),
            status: nextAmount <= Number(purchase.debt.paidAmount) ? 'PAID' : purchase.debt.status,
          },
        });
      }

      await auditLog({ tenantId, branchId, actorId, action: 'CREATE', entity: 'PurchaseReturn', entityId: purchaseReturn.id, after: purchaseReturn, req }, tx);
      return purchaseReturn;
    });

    return sendSuccess(res, result, 'Purchase return created', 201);
  } catch (error) {
    return next(error);
  }
};
