import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { auditLog } from '../../lib/audit';
import { prisma } from '../../lib/prisma';
import { HttpError, sendSuccess } from '../../utils/apiResponse';
import { getBranchId, getTenantId } from '../../utils/scope';

const money = (value: number) => value.toFixed(2);

const createBatchSchema = z.object({
  productId: z.string().uuid(),
  batchNumber: z.string().min(1),
  expiredDate: z.coerce.date(),
  buyPrice: z.coerce.number().nonnegative(),
  stock: z.number().int().min(0),
  locationId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

const createOpnameSchema = z.object({
  code: z.string().min(1),
  notes: z.string().optional(),
  items: z.array(z.object({
    batchId: z.string().uuid(),
    realStock: z.number().int().min(0),
  })).min(1),
});

const idParamSchema = z.object({
  id: z.string().uuid(),
});

const internalMutationSchema = z.object({
  batchId: z.string().uuid(),
  toLocationId: z.string().uuid(),
  qty: z.number().int().positive().optional(),
  notes: z.string().optional(),
});

const opnameUpdateSchema = z.object({ notes: z.string().optional() });
const physicalCountsSchema = z.object({ items: z.array(z.object({ batchId: z.string().uuid(), realStock: z.number().int().min(0) })).min(1) });

export const stockOverview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const batches = await prisma.productBatch.findMany({
      where: { tenantId, branchId },
      include: { product: true, location: true },
      orderBy: [{ product: { name: 'asc' } }, { expiredDate: 'asc' }],
    });

    const overview = batches.reduce<Record<string, {
      productId: string;
      code: string;
      name: string;
      totalStock: number;
      reservedStock: number;
      availableStock: number;
      minStock: number;
      nearestExpiredDate: Date | null;
      locations: string[];
    }>>((acc, batch) => {
      const current = acc[batch.productId] ?? {
        productId: batch.productId,
        code: batch.product.code,
        name: batch.product.name,
        totalStock: 0,
        reservedStock: 0,
        availableStock: 0,
        minStock: batch.product.minStock,
        nearestExpiredDate: null,
        locations: [],
      };

      current.totalStock += batch.stock;
      current.reservedStock += batch.reservedStock;
      current.availableStock += Math.max(0, batch.stock - batch.reservedStock);
      current.nearestExpiredDate =
        current.nearestExpiredDate && current.nearestExpiredDate < batch.expiredDate
          ? current.nearestExpiredDate
          : batch.expiredDate;
      if (batch.location?.name && !current.locations.includes(batch.location.name)) {
        current.locations.push(batch.location.name);
      }
      acc[batch.productId] = current;
      return acc;
    }, {});

    return sendSuccess(res, Object.values(overview), 'Stock overview retrieved');
  } catch (error) {
    return next(error);
  }
};

export const stockCard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const productId = z.string().uuid().parse(req.params.id);
    const ledgers = await prisma.stockLedger.findMany({
      where: { tenantId, branchId, productId },
      include: { batch: true, location: true, user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return sendSuccess(res, ledgers, 'Stock card retrieved');
  } catch (error) {
    return next(error);
  }
};

export const defekta = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const batches = await prisma.productBatch.findMany({
      where: { tenantId, branchId, status: 'AVAILABLE' },
      include: { product: true },
    });
    const totals = batches.reduce<Record<string, { productId: string; code: string; name: string; stock: number; minStock: number }>>((acc, batch) => {
      const current = acc[batch.productId] ?? {
        productId: batch.productId,
        code: batch.product.code,
        name: batch.product.name,
        stock: 0,
        minStock: batch.product.minStock,
      };
      current.stock += batch.stock;
      acc[batch.productId] = current;
      return acc;
    }, {});

    return sendSuccess(res, Object.values(totals).filter((item) => item.stock <= item.minStock), 'Defekta retrieved');
  } catch (error) {
    return next(error);
  }
};

export const reminderEd = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const days = z.coerce.number().int().positive().default(90).parse(req.query.days);
    const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const batches = await prisma.productBatch.findMany({
      where: {
        tenantId,
        branchId,
        stock: { gt: 0 },
        status: 'AVAILABLE',
        expiredDate: { lte: until },
      },
      include: { product: true, location: true },
      orderBy: { expiredDate: 'asc' },
    });

    return sendSuccess(res, batches, 'Expiry reminder retrieved', 200, { days });
  } catch (error) {
    return next(error);
  }
};

export const createBatch = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const payload = createBatchSchema.parse(req.body);
    const batch = await prisma.$transaction(async (tx) => {
      const created = await tx.productBatch.create({
        data: {
          tenantId,
          branchId,
          productId: payload.productId,
          locationId: payload.locationId,
          batchNumber: payload.batchNumber,
          expiredDate: payload.expiredDate,
          buyPrice: money(payload.buyPrice),
          stock: payload.stock,
        },
      });

      await tx.stockLedger.create({
        data: {
          tenantId,
          branchId,
          productId: payload.productId,
          batchId: created.id,
          locationId: payload.locationId,
          userId: req.auth?.userId,
          type: 'PURCHASE',
          qtyChange: payload.stock,
          finalStock: payload.stock,
          refType: 'ProductBatch',
          refId: created.id,
          sourceDocumentNo: payload.batchNumber,
          notes: payload.notes ?? 'Initial batch stock',
        },
      });

      await auditLog({ tenantId, branchId, actorId: req.auth?.userId, action: 'CREATE', entity: 'ProductBatch', entityId: created.id, after: created, req }, tx);
      return created;
    });

    return sendSuccess(res, batch, 'Product batch created', 201);
  } catch (error) {
    return next(error);
  }
};

export const listOpnames = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const opnames = await prisma.stockOpname.findMany({
      where: { tenantId, branchId },
      include: { staff: { select: { id: true, name: true } }, items: true },
      orderBy: { createdAt: 'desc' },
    });

    return sendSuccess(res, opnames, 'Stock opnames retrieved');
  } catch (error) {
    return next(error);
  }
};

export const createOpname = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const staffId = req.auth?.userId;
    if (!staffId) throw new HttpError('Authentication required', 401, 'UNAUTHENTICATED');

    const payload = createOpnameSchema.parse(req.body);
    const opname = await prisma.$transaction(async (tx) => {
      const batches = await tx.productBatch.findMany({
        where: { tenantId, branchId, id: { in: payload.items.map((item) => item.batchId) } },
      });
      const batchById = new Map(batches.map((batch) => [batch.id, batch]));

      const created = await tx.stockOpname.create({
        data: {
          tenantId,
          branchId,
          staffId,
          code: payload.code,
          notes: payload.notes,
          items: {
            create: payload.items.map((item) => {
              const batch = batchById.get(item.batchId);
              if (!batch) throw new HttpError(`Batch not found: ${item.batchId}`, 404, 'BATCH_NOT_FOUND');
              return {
                tenantId,
                batchId: item.batchId,
                systemStock: batch.stock,
                realStock: item.realStock,
                difference: item.realStock - batch.stock,
              };
            }),
          },
        },
        include: { items: true },
      });

      await auditLog({ tenantId, branchId, actorId: staffId, action: 'CREATE', entity: 'StockOpname', entityId: created.id, after: created, req }, tx);
      return created;
    });

    return sendSuccess(res, opname, 'Stock opname created', 201);
  } catch (error) {
    return next(error);
  }
};

export const getOpnameItems = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const id = idParamSchema.parse(req.params).id;
    const opname = await prisma.stockOpname.findFirstOrThrow({ where: { id, tenantId, branchId }, include: { items: { include: { batch: { include: { product: true, location: true } } } } } });
    return sendSuccess(res, opname.items, 'Stock opname items retrieved');
  } catch (error) { return next(error); }
};

export const updateOpname = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const id = idParamSchema.parse(req.params).id;
    const payload = opnameUpdateSchema.parse(req.body);
    const updated = await prisma.$transaction(async (tx) => {
      const before = await tx.stockOpname.findFirstOrThrow({ where: { id, tenantId, branchId, status: 'DRAFT' }, include: { items: true } });
      const result = await tx.stockOpname.update({ where: { id }, data: { notes: payload.notes }, include: { items: true } });
      await auditLog({ tenantId, branchId, actorId: req.auth?.userId, action: 'UPDATE', entity: 'StockOpname', entityId: id, before, after: result, req }, tx);
      return result;
    });
    return sendSuccess(res, updated, 'Stock opname updated');
  } catch (error) { return next(error); }
};

export const updatePhysicalCounts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const id = idParamSchema.parse(req.params).id;
    const payload = physicalCountsSchema.parse(req.body);
    const updated = await prisma.$transaction(async (tx) => {
      const opname = await tx.stockOpname.findFirstOrThrow({ where: { id, tenantId, branchId, status: 'DRAFT' }, include: { items: true } });
      const itemsByBatch = new Map(opname.items.map((item) => [item.batchId, item]));
      for (const input of payload.items) {
        const item = itemsByBatch.get(input.batchId);
        if (!item) throw new HttpError(`Batch is not part of opname: ${input.batchId}`, 400, 'OPNAME_BATCH_INVALID');
        await tx.stockOpnameItem.update({ where: { id: item.id }, data: { realStock: input.realStock, difference: input.realStock - item.systemStock } });
      }
      const result = await tx.stockOpname.findUniqueOrThrow({ where: { id }, include: { items: true } });
      await auditLog({ tenantId, branchId, actorId: req.auth?.userId, action: 'UPDATE', entity: 'StockOpname', entityId: id, before: opname, after: result, req }, tx);
      return result;
    });
    return sendSuccess(res, updated, 'Stock opname counts updated');
  } catch (error) { return next(error); }
};

export const closeOpname = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const { id } = idParamSchema.parse(req.params);
    const result = await prisma.$transaction(async (tx) => {
      const opname = await tx.stockOpname.findFirstOrThrow({
        where: { id, tenantId, branchId, status: 'DRAFT' },
        include: { items: true },
      });

      for (const item of opname.items) {
        const batch = await tx.productBatch.findFirstOrThrow({ where: { id: item.batchId, tenantId, branchId } });
        await tx.productBatch.update({
          where: { id: item.batchId },
          data: { stock: item.realStock },
        });
        await tx.stockLedger.create({
          data: {
            tenantId,
            branchId,
            productId: batch.productId,
            batchId: batch.id,
            locationId: batch.locationId,
            userId: req.auth?.userId,
            type: 'OPNAME_ADJUST',
            qtyChange: item.difference,
            finalStock: item.realStock,
            refType: 'StockOpname',
            refId: opname.id,
            sourceDocumentNo: opname.code,
            notes: 'Stock opname close',
          },
        });
      }

      const closed = await tx.stockOpname.update({
        where: { id },
        data: { status: 'CLOSED', closedAt: new Date() },
        include: { items: true },
      });
      await auditLog({ tenantId, branchId, actorId: req.auth?.userId, action: 'UPDATE', entity: 'StockOpname', entityId: id, before: opname, after: closed, req }, tx);
      return closed;
    });

    return sendSuccess(res, result, 'Stock opname closed');
  } catch (error) {
    return next(error);
  }
};

export const internalMutation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const payload = internalMutationSchema.parse(req.body);
    const result = await prisma.$transaction(async (tx) => {
      const batch = await tx.productBatch.findFirstOrThrow({ where: { id: payload.batchId, tenantId, branchId } });
      const qty = payload.qty ?? batch.stock;
      if (qty !== batch.stock) {
        throw new HttpError('Partial rack mutation needs a dedicated split-batch workflow', 409, 'PARTIAL_MUTATION_NOT_SUPPORTED', {
          requestedQty: qty,
          batchStock: batch.stock,
        });
      }

      const updated = await tx.productBatch.update({
        where: { id: batch.id },
        data: { locationId: payload.toLocationId },
      });

      await tx.stockLedger.create({
        data: {
          tenantId,
          branchId,
          productId: batch.productId,
          batchId: batch.id,
          locationId: payload.toLocationId,
          userId: req.auth?.userId,
          type: 'MANUAL_ADJUST',
          qtyChange: 0,
          finalStock: batch.stock,
          refType: 'InternalMutation',
          refId: batch.id,
          notes: payload.notes ?? 'Internal rack/location mutation',
        },
      });

      await auditLog({ tenantId, branchId, actorId: req.auth?.userId, action: 'UPDATE', entity: 'ProductBatch', entityId: batch.id, before: batch, after: updated, req }, tx);
      return updated;
    });

    return sendSuccess(res, result, 'Internal stock mutation completed');
  } catch (error) {
    return next(error);
  }
};

export const listInternalMutations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const ledgers = await prisma.stockLedger.findMany({
      where: { tenantId, branchId, refType: 'InternalMutation' },
      include: { batch: { include: { product: true } }, location: true, user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return sendSuccess(res, ledgers, 'Internal stock mutations retrieved');
  } catch (error) { return next(error); }
};
