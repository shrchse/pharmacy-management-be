import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { auditLog } from '../../lib/audit';
import { prisma } from '../../lib/prisma';
import { HttpError, sendSuccess } from '../../utils/apiResponse';
import { getTenantId } from '../../utils/scope';

const idParamSchema = z.object({
  id: z.string().uuid(),
});

const productSchema = z.object({
  categoryId: z.string().uuid(),
  defaultSupplierId: z.string().uuid().optional(),
  code: z.string().min(1),
  barcode: z.string().optional(),
  name: z.string().min(1),
  genericName: z.string().optional(),
  brandName: z.string().optional(),
  registrationNumber: z.string().optional(),
  dosageForm: z.string().optional(),
  strength: z.string().optional(),
  composition: z.string().optional(),
  manufacturer: z.string().optional(),
  principal: z.string().optional(),
  productType: z.enum(['MEDICINE', 'MEDICAL_DEVICE', 'CONSUMABLE', 'COSMETIC', 'GENERAL', 'COMPOUND']).default('MEDICINE'),
  controlledClass: z.enum(['NONE', 'OBAT_KERAS', 'PSIKOTROPIKA', 'NARKOTIKA']).default('NONE'),
  requiresPrescription: z.boolean().default(false),
  minStock: z.number().int().min(0).default(10),
  maxStock: z.number().int().min(0).optional(),
  unitId: z.string().uuid(),
  conversion: z.number().int().positive().default(1),
  sellingPrice: z.coerce.number().nonnegative(),
  purchasePrice: z.coerce.number().nonnegative().optional(),
});

const updateProductSchema = productSchema.omit({ unitId: true, conversion: true }).partial().extend({
  status: z.enum(['ACTIVE', 'INACTIVE', 'DISCONTINUED']).optional(),
});

const money = (value: number) => value.toFixed(2);

const productInclude = {
  category: true,
  defaultSupplier: true,
  units: { include: { unit: true } },
} as const;

export const listProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const products = await prisma.product.findMany({
      where: { tenantId },
      include: productInclude,
      orderBy: { name: 'asc' },
    });

    return sendSuccess(res, products, 'Products retrieved');
  } catch (error) {
    return next(error);
  }
};

export const searchProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const q = z.string().trim().optional().parse(req.query.q);
    const products = await prisma.product.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        OR: q
          ? [
              { name: { contains: q, mode: 'insensitive' } },
              { genericName: { contains: q, mode: 'insensitive' } },
              { code: { contains: q, mode: 'insensitive' } },
              { barcode: { contains: q, mode: 'insensitive' } },
              { composition: { contains: q, mode: 'insensitive' } },
            ]
          : undefined,
      },
      include: productInclude,
      orderBy: { name: 'asc' },
      take: 50,
    });

    return sendSuccess(res, products, 'Product search completed', 200, { count: products.length });
  } catch (error) {
    return next(error);
  }
};

export const getProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = idParamSchema.parse(req.params);
    const product = await prisma.product.findFirstOrThrow({
      where: { id, tenantId },
      include: {
        ...productInclude,
        batches: { orderBy: { expiredDate: 'asc' } },
      },
    });

    return sendSuccess(res, product, 'Product retrieved');
  } catch (error) {
    return next(error);
  }
};

export const createProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const payload = productSchema.parse(req.body);
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          tenantId,
          categoryId: payload.categoryId,
          defaultSupplierId: payload.defaultSupplierId,
          code: payload.code,
          barcode: payload.barcode,
          name: payload.name,
          genericName: payload.genericName,
          brandName: payload.brandName,
          registrationNumber: payload.registrationNumber,
          dosageForm: payload.dosageForm,
          strength: payload.strength,
          composition: payload.composition,
          manufacturer: payload.manufacturer,
          principal: payload.principal,
          productType: payload.productType,
          controlledClass: payload.controlledClass,
          requiresPrescription: payload.requiresPrescription,
          minStock: payload.minStock,
          maxStock: payload.maxStock,
          units: {
            create: {
              unitId: payload.unitId,
              conversion: payload.conversion,
              isBaseUnit: true,
              sellingPrice: money(payload.sellingPrice),
              purchasePrice: payload.purchasePrice === undefined ? undefined : money(payload.purchasePrice),
            },
          },
        },
        include: productInclude,
      });

      await auditLog({ tenantId, actorId: req.auth?.userId, action: 'CREATE', entity: 'Product', entityId: created.id, after: created, req }, tx);
      return created;
    });

    return sendSuccess(res, product, 'Product created', 201);
  } catch (error) {
    return next(error);
  }
};

export const updateProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = idParamSchema.parse(req.params);
    const payload = updateProductSchema.parse(req.body);
    const product = await prisma.$transaction(async (tx) => {
      const before = await tx.product.findFirstOrThrow({ where: { id, tenantId }, include: productInclude });
      const { sellingPrice, purchasePrice, ...productPayload } = payload;
      const updated = await tx.product.update({
        where: { id },
        data: productPayload,
        include: productInclude,
      });

      if (sellingPrice !== undefined || purchasePrice !== undefined) {
        const baseUnit = before.units.find((unit) => unit.isBaseUnit) ?? before.units[0];
        if (baseUnit) {
          await tx.productUnit.update({
            where: { id: baseUnit.id },
            data: {
              sellingPrice: sellingPrice === undefined ? undefined : money(sellingPrice),
              purchasePrice: purchasePrice === undefined ? undefined : money(purchasePrice),
            },
          });
        }
      }

      const withUnits = await tx.product.findUniqueOrThrow({ where: { id }, include: productInclude });
      await auditLog({ tenantId, actorId: req.auth?.userId, action: 'UPDATE', entity: 'Product', entityId: id, before, after: withUnits, req }, tx);
      return updated;
    });

    return sendSuccess(res, product, 'Product updated');
  } catch (error) {
    return next(error);
  }
};

export const deleteProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = idParamSchema.parse(req.params);
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirstOrThrow({ where: { id, tenantId }, include: productInclude });
      const [saleItems, purchaseItems, batches, stockLedgers] = await Promise.all([
        tx.saleItem.count({ where: { tenantId, productId: id } }),
        tx.purchaseItem.count({ where: { tenantId, productId: id } }),
        tx.productBatch.count({ where: { tenantId, productId: id } }),
        tx.stockLedger.count({ where: { tenantId, productId: id } }),
      ]);
      const historyCount = saleItems + purchaseItems + batches + stockLedgers;

      if (historyCount > 0) {
        throw new HttpError('Product has transaction or stock history and cannot be deleted directly', 409, 'PRODUCT_HAS_HISTORY', {
          saleItems,
          purchaseItems,
          batches,
          stockLedgers,
        });
      }

      await tx.product.delete({ where: { id } });
      await auditLog({ tenantId, actorId: req.auth?.userId, action: 'DELETE', entity: 'Product', entityId: id, before: product, req }, tx);
      return { id, deleted: true };
    });

    return sendSuccess(res, result, 'Product deleted');
  } catch (error) {
    return next(error);
  }
};

export const listProductBatches = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = idParamSchema.parse(req.params);
    const batches = await prisma.productBatch.findMany({
      where: { tenantId, productId: id },
      include: { location: true },
      orderBy: [{ expiredDate: 'asc' }, { createdAt: 'asc' }],
    });

    return sendSuccess(res, batches, 'Product batches retrieved');
  } catch (error) {
    return next(error);
  }
};
