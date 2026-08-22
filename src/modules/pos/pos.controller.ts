import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { auditLog } from '../../lib/audit';
import {
  completeIdempotencyRecord,
  createIdempotencyRecord,
  findIdempotencyRecord,
  getIdempotencyKey,
  hashRequestBody,
} from '../../lib/idempotency';
import { prisma } from '../../lib/prisma';
import { assertSupervisorAuthorizations, consumeSupervisorAuthorizations, SupervisorAction } from '../../lib/supervisor';
import { Prisma } from '../../generated/prisma/client';
import { HttpError, sendError, sendSuccess } from '../../utils/apiResponse';
import { getBranchId, getTenantId } from '../../utils/scope';

const money = (value: number) => value.toFixed(2);

const paymentMethodSchema = z.enum(['CASH', 'QRIS', 'DEBIT_CARD', 'CREDIT_CARD', 'TRANSFER', 'E_WALLET', 'CREDIT']);
const checkoutSchema = z.object({
  cashierId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  doctorId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
  saleType: z.enum(['REGULAR', 'PRESCRIPTION', 'COMPOUND']).optional(),
  trxType: z.enum(['bebas', 'resep', 'racikan', 'REGULAR', 'PRESCRIPTION', 'COMPOUND']).optional(),
  channel: z.enum(['OFFLINE', 'WHATSAPP', 'MARKETPLACE', 'ONLINE_STORE', 'MOBILE_OFFLINE']).default('OFFLINE'),
  discountAmount: z.coerce.number().nonnegative().optional(),
  discount: z.coerce.number().nonnegative().optional(),
  taxAmount: z.coerce.number().nonnegative().default(0),
  method: z.string().optional(),
  paid: z.coerce.number().nonnegative().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    productUnitId: z.string().uuid().optional(),
    batchId: z.string().uuid().optional(),
    qty: z.number().int().positive(),
    unitPrice: z.coerce.number().nonnegative().optional(),
    discountAmount: z.coerce.number().nonnegative().default(0),
  })).min(1).optional(),
  lines: z.array(z.object({
    productId: z.string().uuid(),
    productUnitId: z.string().uuid().optional(),
    qty: z.number().int().positive(),
    price: z.coerce.number().nonnegative().optional(),
    unitPrice: z.coerce.number().nonnegative().optional(),
    discount: z.coerce.number().nonnegative().default(0),
  })).min(1).optional(),
  payments: z.array(z.object({
    method: paymentMethodSchema,
    amount: z.coerce.number().nonnegative(),
    referenceNo: z.string().optional(),
  })).default([]),
  supervisorAuthorizationIds: z.array(z.string().uuid()).default([]),
}).superRefine((value, context) => {
  if (!value.items && !value.lines) context.addIssue({ code: z.ZodIssueCode.custom, message: 'items or lines is required', path: ['items'] });
}).transform((value) => {
  const methodMap: Record<string, z.infer<typeof paymentMethodSchema>> = { tunai: 'CASH', cash: 'CASH', qris: 'QRIS', transfer: 'TRANSFER', debit: 'DEBIT_CARD', credit: 'CREDIT' };
  const saleTypeMap: Record<string, 'REGULAR' | 'PRESCRIPTION' | 'COMPOUND'> = { bebas: 'REGULAR', resep: 'PRESCRIPTION', racikan: 'COMPOUND', REGULAR: 'REGULAR', PRESCRIPTION: 'PRESCRIPTION', COMPOUND: 'COMPOUND' };
  const saleType = value.saleType ?? saleTypeMap[value.trxType ?? 'bebas'] ?? 'REGULAR';
  const items = value.items ?? value.lines!.map((line) => ({ productId: line.productId, productUnitId: line.productUnitId, batchId: undefined, qty: line.qty, unitPrice: line.unitPrice ?? line.price, discountAmount: line.discount }));
  const payments = value.payments.length > 0 ? value.payments : value.paid === undefined ? [] : [{ method: methodMap[(value.method ?? 'CASH').toLowerCase()] ?? 'CASH', amount: value.paid, referenceNo: undefined }];
  return { ...value, saleType, items, payments, discountAmount: value.discountAmount ?? value.discount ?? 0 };
});

const invoiceNumber = () => {
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `INV-${stamp}-${suffix}`;
};

const findOrCreatePosCashAccount = async (tx: Prisma.TransactionClient, tenantId: string, branchId: string) => {
  const account = await tx.cashAccount.findFirst({
    where: {
      tenantId,
      isActive: true,
      OR: [{ branchId }, { branchId: null }],
    },
    orderBy: [{ branchId: 'desc' }, { createdAt: 'asc' }],
  });

  if (account) return account;

  return tx.cashAccount.create({
    data: {
      tenantId,
      branchId,
      code: `POS-${branchId.slice(0, 8).toUpperCase()}`,
      name: 'POS Cash Account',
      balance: money(0),
    },
  });
};

const toJsonValue = (value: unknown): Prisma.InputJsonValue => {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
};

export const checkout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const payload = checkoutSchema.parse(req.body);
    const cashierId = payload.cashierId ?? req.auth?.userId;
    if (!cashierId) return sendError(res, 'cashierId is required', 400, undefined, 'CASHIER_REQUIRED');
    if (cashierId !== req.auth?.userId) return sendError(res, 'cashierId must match the authenticated user', 403, undefined, 'CASHIER_SCOPE_DENIED');

    const idempotencyKey = getIdempotencyKey(req);
    if (!idempotencyKey) {
      return sendError(res, 'Idempotency-Key header is required', 400, undefined, 'IDEMPOTENCY_KEY_REQUIRED');
    }
    const requestHash = hashRequestBody({ tenantId, branchId, cashierId, ...payload });

    const result = await prisma.$transaction(async (tx) => {
      const existing = await findIdempotencyRecord(tx, tenantId, branchId, idempotencyKey);
      if (existing) {
        if (existing.requestHash !== requestHash) {
          throw new HttpError('Idempotency-Key was already used for a different request', 409, 'IDEMPOTENCY_KEY_CONFLICT');
        }
        if (existing.status === 'COMPLETED' && existing.responseBody) {
          return { cached: true, statusCode: existing.statusCode ?? 200, body: existing.responseBody };
        }
        throw new HttpError('Request with this Idempotency-Key is still processing', 409, 'IDEMPOTENCY_KEY_PROCESSING');
      }

      await createIdempotencyRecord(tx, {
        tenantId,
        branchId,
        userId: req.auth?.userId,
        key: idempotencyKey,
        requestHash,
      });

      const session = payload.sessionId
        ? await tx.cashierSession.findFirst({
            where: { id: payload.sessionId, tenantId, branchId, cashierId, status: 'OPEN', closedAt: null },
          })
        : await tx.cashierSession.findFirst({
            where: { tenantId, branchId, cashierId, status: 'OPEN', closedAt: null },
            orderBy: { openedAt: 'desc' },
          });

      if (!session) {
        throw new HttpError('Open cashier shift is required before checkout', 409, 'SHIFT_REQUIRED');
      }

      const productUnits = await tx.productUnit.findMany({
        where: { id: { in: payload.items.map((item) => item.productUnitId).filter((id): id is string => Boolean(id)) } },
      });
      const unitById = new Map(productUnits.map((unit) => [unit.id, unit]));
      const saleItems = [];
      let totalAmount = 0;
      let grossAmount = 0;
      let costAmount = 0;
      const authorizedActions = new Set<SupervisorAction>();
      const authorize = async (action: SupervisorAction) => {
        if (!authorizedActions.has(action)) {
          await assertSupervisorAuthorizations(tx, payload.supervisorAuthorizationIds, { tenantId, branchId, requestedById: cashierId, action });
          authorizedActions.add(action);
        }
      };

      for (const item of payload.items) {
        const productUnit = item.productUnitId
          ? unitById.get(item.productUnitId)
          : await tx.productUnit.findFirst({ where: { productId: item.productId, isBaseUnit: true }, include: { unit: true } });
        if (!productUnit || productUnit.productId !== item.productId) {
          throw new HttpError(`Product unit does not match product: ${item.productUnitId}`, 400, 'PRODUCT_UNIT_MISMATCH');
        }

        const baseQty = item.qty * productUnit.conversion;
        let batch = item.batchId
          ? await tx.productBatch.findFirst({
              where: {
                id: item.batchId,
                tenantId,
                branchId,
                productId: item.productId,
                status: 'AVAILABLE',
              },
            })
          : await tx.productBatch.findFirst({
              where: {
                tenantId,
                branchId,
                productId: item.productId,
                status: 'AVAILABLE',
                stock: { gte: baseQty },
              },
              orderBy: [{ expiredDate: 'asc' }, { createdAt: 'asc' }],
            });

        let allowEmptyStock = false;
        if (!batch || batch.stock < baseQty) {
          await authorize('sell_empty_stock');
          allowEmptyStock = true;
          batch = item.batchId
            ? await tx.productBatch.findFirst({ where: { id: item.batchId, tenantId, branchId, productId: item.productId, status: 'AVAILABLE' } })
            : await tx.productBatch.findFirst({ where: { tenantId, branchId, productId: item.productId, status: 'AVAILABLE' }, orderBy: [{ expiredDate: 'asc' }, { createdAt: 'asc' }] });
        }
        if (!batch) {
          throw new HttpError(`Insufficient stock for product: ${item.productId}`, 409, 'INSUFFICIENT_STOCK');
        }

        const stockUpdate = await tx.productBatch.updateMany({
          where: {
            id: batch.id,
            tenantId,
            branchId,
            status: 'AVAILABLE',
            ...(allowEmptyStock ? {} : { stock: { gte: baseQty } }),
          },
          data: { stock: { decrement: baseQty } },
        });

        if (stockUpdate.count !== 1) {
          throw new HttpError(`Stock changed before checkout could complete: ${item.productId}`, 409, 'STOCK_RACE_CONDITION');
        }

        const unitPrice = item.unitPrice ?? Number(productUnit.sellingPrice);
        const subtotal = item.qty * unitPrice - item.discountAmount;
        if (subtotal < 0) throw new HttpError(`Discount exceeds line total for product: ${item.productId}`, 400, 'INVALID_DISCOUNT');
        grossAmount += item.qty * unitPrice;
        totalAmount += subtotal;
        costAmount += baseQty * Number(batch.buyPrice);

        saleItems.push({
          tenantId,
          productId: item.productId,
          productUnitId: productUnit.id,
          batchId: batch.id,
          qty: item.qty,
          baseQty,
          unitPrice: money(unitPrice),
          discountAmount: money(item.discountAmount),
          subtotal: money(subtotal),
          costAmount: money(baseQty * Number(batch.buyPrice)),
          finalStock: batch.stock - baseQty,
        });
      }

      const itemDiscountAmount = payload.items.reduce((sum, item) => sum + item.discountAmount, 0);
      if (payload.discountAmount + itemDiscountAmount > grossAmount * 0.5) await authorize('discount_over_50');

      const grandTotal = totalAmount - payload.discountAmount + payload.taxAmount;
      if (grandTotal < 0) throw new HttpError('Discount and tax produce an invalid total', 400, 'INVALID_TOTAL');
      const paidAmount = payload.payments.filter((payment) => payment.method !== 'CREDIT').reduce((sum, payment) => sum + payment.amount, 0);
      const createdSale = await tx.sale.create({
        data: {
          tenantId,
          branchId,
          invoiceNumber: invoiceNumber(),
          channel: payload.channel,
          sessionId: session.id,
          cashierId,
          customerId: payload.customerId,
          saleType: payload.saleType,
          paymentStatus: paidAmount >= grandTotal ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'UNPAID',
          totalAmount: money(totalAmount),
          discountAmount: money(payload.discountAmount),
          taxAmount: money(payload.taxAmount),
          grandTotal: money(grandTotal),
          paidAmount: money(paidAmount),
          changeAmount: money(Math.max(0, paidAmount - grandTotal)),
          saleItems: {
            create: saleItems.map(({ finalStock: _finalStock, ...item }) => item),
          },
          payments: {
            create: payload.payments.map((payment) => ({
              tenantId,
              method: payment.method,
              amount: money(payment.amount),
              referenceNo: payment.referenceNo,
            })),
          },
        },
        include: {
          saleItems: { include: { product: true, productUnit: { include: { unit: true } }, batch: true } },
          payments: true,
          customer: true,
          cashier: { select: { id: true, name: true, email: true } },
          branch: true,
        },
      });

      await tx.stockLedger.createMany({
        data: saleItems.map((item) => ({
          tenantId,
          branchId,
          productId: item.productId,
          batchId: item.batchId,
          userId: cashierId,
          type: 'SALE',
          qtyChange: -item.baseQty,
          finalStock: item.finalStock,
          refType: 'Sale',
          refId: createdSale.id,
          sourceDocumentNo: createdSale.invoiceNumber,
          notes: payload.notes ?? 'POS checkout',
        })),
      });

      const cashLikePaidAmount = payload.payments
        .filter((payment) => payment.method !== 'CREDIT')
        .reduce((sum, payment) => sum + payment.amount, 0);
      const cashCollectedAmount = Math.max(0, cashLikePaidAmount - Math.max(0, paidAmount - grandTotal));

      if (cashCollectedAmount > 0) {
        const cashAccount = await findOrCreatePosCashAccount(tx, tenantId, branchId);
        await tx.cashMutation.create({
          data: {
            tenantId,
            branchId,
            cashAccountId: cashAccount.id,
            type: 'SALE_PAYMENT',
            amount: money(cashCollectedAmount),
            refType: 'Sale',
            refId: createdSale.id,
            notes: `POS payment ${createdSale.invoiceNumber}`,
            createdById: cashierId,
          },
        });
        await tx.cashAccount.update({
          where: { id: cashAccount.id },
            data: { balance: { increment: cashCollectedAmount } },
        });
      }

      if (paidAmount < grandTotal) {
        await tx.receivable.create({
          data: {
            tenantId,
            branchId,
            customerId: payload.customerId,
            saleId: createdSale.id,
            invoiceNo: createdSale.invoiceNumber,
            amount: money(grandTotal),
            paidAmount: money(paidAmount),
            status: paidAmount > 0 ? 'PARTIAL' : 'UNPAID',
          },
        });
      }

      for (const action of authorizedActions) {
        await consumeSupervisorAuthorizations(tx, payload.supervisorAuthorizationIds, { tenantId, branchId, requestedById: cashierId, action });
      }

      const responseBody = {
        ...createdSale,
        grossProfit: money(totalAmount - costAmount),
      };

      await auditLog({ tenantId, branchId, actorId: cashierId, action: 'CREATE', entity: 'Sale', entityId: createdSale.id, after: responseBody, metadata: { idempotencyKey }, req }, tx);
      await completeIdempotencyRecord(tx, {
        tenantId,
        branchId,
        key: idempotencyKey,
        statusCode: 201,
        responseBody: toJsonValue(responseBody),
      });

      return { cached: false, statusCode: 201, body: responseBody };
    });

    return sendSuccess(res, result.body, result.cached ? 'Checkout replayed from idempotency cache' : 'Checkout completed', result.statusCode);
  } catch (error) {
    return next(error);
  }
};
