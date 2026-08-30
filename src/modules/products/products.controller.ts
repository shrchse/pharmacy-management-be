import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { auditLog } from '../../lib/audit';
import { prisma } from '../../lib/prisma';
import { HttpError, sendSuccess } from '../../utils/apiResponse';
import { getTenantId } from '../../utils/scope';
import { assertSupervisorAuthorizations, consumeSupervisorAuthorizations } from '../../lib/supervisor';

const idParamSchema = z.object({
  id: z.string().uuid(),
});

const productSchema = z.object({
  catalogId: z.string().uuid().optional(),
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

const productUnitSchema = z.object({
  unitId: z.string().uuid(),
  conversion: z.number().int().positive().default(1),
  barcode: z.string().optional(),
  sellingPrice: z.coerce.number().nonnegative(),
  purchasePrice: z.coerce.number().nonnegative().optional(),
  isBaseUnit: z.boolean().default(false),
});
const productUnitUpdateSchema = productUnitSchema.partial();

const updateProductSchema = productSchema.omit({ unitId: true, conversion: true }).partial().extend({
  status: z.enum(['ACTIVE', 'INACTIVE', 'DISCONTINUED']).optional(),
  supervisorAuthorizationIds: z.array(z.string().uuid()).default([]),
});

const money = (value: number) => value.toFixed(2);

const productInclude = {
  category: true,
  defaultSupplier: true,
  catalog: true,
  tenantProduct: { include: { catalog: true } },
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
    if (payload.conversion !== 1) {
      throw new HttpError('Initial product unit must be the base unit with conversion 1; add strip/box as an additional unit', 400, 'BASE_UNIT_CONVERSION_REQUIRED');
    }
    const product = await prisma.$transaction(async (tx) => {
      const catalog = payload.catalogId
        ? await tx.productCatalog.findFirst({ where: { id: payload.catalogId, isActive: true } })
        : null;
      if (payload.catalogId && !catalog) throw new HttpError('Active product catalog item not found', 404, 'CATALOG_ITEM_NOT_FOUND');

      const created = await tx.product.create({
        data: {
          tenantId,
          catalogId: catalog?.id,
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
          ...(catalog ? {
            tenantProduct: {
              create: {
                tenantId,
                catalogId: catalog.id,
                minStock: payload.minStock,
                isActive: true,
              },
            },
          } : {}),
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

export const addProductUnit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = idParamSchema.parse(req.params);
    const payload = productUnitSchema.parse(req.body);
    if (payload.isBaseUnit && payload.conversion !== 1) {
      throw new HttpError('Base unit must use conversion 1', 400, 'BASE_UNIT_CONVERSION_REQUIRED');
    }

    const unit = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({ where: { id, tenantId } });
      if (!product) throw new HttpError('Product not found', 404, 'PRODUCT_NOT_FOUND');
      const tenantUnit = await tx.unit.findFirst({ where: { id: payload.unitId, tenantId } });
      if (!tenantUnit) throw new HttpError('Unit not found for tenant', 404, 'UNIT_NOT_FOUND');
      if (payload.isBaseUnit) {
        const existingBase = await tx.productUnit.findFirst({ where: { productId: id, isBaseUnit: true } });
        if (existingBase) throw new HttpError('Product already has a base unit', 409, 'BASE_UNIT_ALREADY_EXISTS');
      }
      const created = await tx.productUnit.create({
        data: {
          productId: id,
          unitId: tenantUnit.id,
          conversion: payload.conversion,
          isBaseUnit: payload.isBaseUnit,
          barcode: payload.barcode,
          sellingPrice: money(payload.sellingPrice),
          purchasePrice: payload.purchasePrice === undefined ? undefined : money(payload.purchasePrice),
        },
        include: { unit: true },
      });
      await auditLog({ tenantId, actorId: req.auth?.userId, action: 'CREATE', entity: 'ProductUnit', entityId: created.id, after: created, req }, tx);
      return created;
    });

    return sendSuccess(res, unit, 'Product unit created', 201);
  } catch (error) {
    return next(error);
  }
};

export const updateProductUnit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const { id, unitId } = z.object({ id: z.string().uuid(), unitId: z.string().uuid() }).parse(req.params);
    const payload = productUnitUpdateSchema.parse(req.body);
    const unit = await prisma.$transaction(async (tx) => {
      const before = await tx.productUnit.findFirst({ where: { id: unitId, productId: id, product: { tenantId } }, include: { unit: true } });
      if (!before) throw new HttpError('Product unit not found', 404, 'PRODUCT_UNIT_NOT_FOUND');
      if (payload.unitId && !(await tx.unit.findFirst({ where: { id: payload.unitId, tenantId } }))) throw new HttpError('Unit not found for tenant', 404, 'UNIT_NOT_FOUND');
      const nextBase = payload.isBaseUnit ?? before.isBaseUnit;
      const nextConversion = payload.conversion ?? before.conversion;
      if (nextBase && nextConversion !== 1) throw new HttpError('Base unit must use conversion 1', 400, 'BASE_UNIT_CONVERSION_REQUIRED');
      if (nextBase && !before.isBaseUnit && await tx.productUnit.findFirst({ where: { productId: id, isBaseUnit: true, id: { not: unitId } } })) throw new HttpError('Product already has a base unit', 409, 'BASE_UNIT_ALREADY_EXISTS');
      if (before.isBaseUnit && payload.isBaseUnit === false) throw new HttpError('Product must retain one base unit', 400, 'BASE_UNIT_REQUIRED');
      const updated = await tx.productUnit.update({ where: { id: unitId }, data: { unitId: payload.unitId, conversion: payload.conversion, isBaseUnit: payload.isBaseUnit, barcode: payload.barcode, sellingPrice: payload.sellingPrice === undefined ? undefined : money(payload.sellingPrice), purchasePrice: payload.purchasePrice === undefined ? undefined : money(payload.purchasePrice) }, include: { unit: true } });
      await auditLog({ tenantId, actorId: req.auth?.userId, action: 'UPDATE', entity: 'ProductUnit', entityId: unitId, before, after: updated, req }, tx);
      return updated;
    });
    return sendSuccess(res, unit, 'Product unit updated');
  } catch (error) {
    return next(error);
  }
};

export const updateProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = req.auth?.branchId;
    const { id } = idParamSchema.parse(req.params);
    const payload = updateProductSchema.parse(req.body);
    const product = await prisma.$transaction(async (tx) => {
      const before = await tx.product.findFirstOrThrow({ where: { id, tenantId }, include: productInclude });
      const { catalogId, sellingPrice, purchasePrice, supervisorAuthorizationIds, ...productPayload } = payload;
      if (catalogId) {
        const catalog = await tx.productCatalog.findFirst({ where: { id: catalogId, isActive: true } });
        if (!catalog) throw new HttpError('Active product catalog item not found', 404, 'CATALOG_ITEM_NOT_FOUND');
        await tx.tenantProduct.upsert({
          where: { productId: id },
          create: { tenantId, catalogId, productId: id, minStock: payload.minStock, isActive: true },
          update: { catalogId, minStock: payload.minStock },
        });
      }
      const pricePolicy = await tx.tenantPolicy.findUnique({ where: { tenantId_code: { tenantId, code: 'inventory.requireSupervisorForPriceEdit' } } });
      const priceGateEnabled = pricePolicy?.value === true || (typeof pricePolicy?.value === 'object' && pricePolicy.value !== null && !Array.isArray(pricePolicy.value) && (pricePolicy.value as { enabled?: unknown }).enabled === true);
      if (sellingPrice !== undefined && priceGateEnabled) {
        if (!branchId) throw new HttpError('branchId is required for supervisor authorization', 400, 'BRANCH_REQUIRED');
        await assertSupervisorAuthorizations(tx, supervisorAuthorizationIds, { tenantId, branchId, requestedById: req.auth!.userId, action: 'edit_sell_price' });
      }
      const updated = await tx.product.update({
        where: { id },
        data: { ...productPayload, ...(catalogId ? { catalogId } : {}) },
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

      if (sellingPrice !== undefined && priceGateEnabled) {
        await consumeSupervisorAuthorizations(tx, supervisorAuthorizationIds, { tenantId, branchId: branchId!, requestedById: req.auth!.userId, action: 'edit_sell_price' });
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
    const branchId = req.auth?.branchId;
    const supervisorAuthorizationIds = z.array(z.string().uuid()).default([]).parse(req.body?.supervisorAuthorizationIds);
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
        if (!branchId) throw new HttpError('branchId is required for supervisor authorization', 400, 'BRANCH_REQUIRED');
        await assertSupervisorAuthorizations(tx, supervisorAuthorizationIds, { tenantId, branchId, requestedById: req.auth!.userId, action: 'delete_product_with_history' });
      }

      if (historyCount > 0) {
        // The authorization above is intentionally consumed in the same transaction
        // as the delete, so a failed delete cannot burn a supervisor approval.
        await tx.product.update({ where: { id }, data: { status: 'DISCONTINUED' } });
        await consumeSupervisorAuthorizations(tx, supervisorAuthorizationIds, { tenantId, branchId: branchId!, requestedById: req.auth!.userId, action: 'delete_product_with_history' });
        await auditLog({ tenantId, actorId: req.auth?.userId, action: 'DELETE', entity: 'Product', entityId: id, before: product, req }, tx);
        return { id, deleted: false, discontinued: true };
      }

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
