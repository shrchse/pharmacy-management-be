import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { auditLog } from '../../lib/audit';
import { prisma } from '../../lib/prisma';
import { HttpError, sendSuccess } from '../../utils/apiResponse';
import { getOptionalBranchId, getTenantId } from '../../utils/scope';

const catalogSchema = z.object({
  globalCode: z.string().trim().min(1),
  barcode: z.string().trim().optional(),
  name: z.string().trim().min(1),
  genericName: z.string().trim().optional(),
  brandName: z.string().trim().optional(),
  registrationNumber: z.string().trim().optional(),
  dosageForm: z.string().trim().optional(),
  strength: z.string().trim().optional(),
  composition: z.string().trim().optional(),
  manufacturer: z.string().trim().optional(),
  principal: z.string().trim().optional(),
  productType: z.enum(['MEDICINE', 'MEDICAL_DEVICE', 'CONSUMABLE', 'COSMETIC', 'GENERAL', 'COMPOUND']).default('MEDICINE'),
  controlledClass: z.enum(['NONE', 'OBAT_KERAS', 'PSIKOTROPIKA', 'NARKOTIKA']).default('NONE'),
  categoryCatalogId: z.string().uuid().optional(),
  defaultUnitCatalogId: z.string().uuid().optional(),
  isActive: z.boolean().default(true),
});

const catalogUpdateSchema = catalogSchema.partial();

const tenantProductSchema = z.object({
  catalogId: z.string().uuid(),
  productId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  unitId: z.string().uuid().optional(),
  defaultSupplierId: z.string().uuid().optional(),
  code: z.string().trim().min(1).optional(),
  conversion: z.number().int().positive().default(1),
  sellingPrice: z.coerce.number().nonnegative().optional(),
  purchasePrice: z.coerce.number().nonnegative().optional(),
  customName: z.string().trim().optional(),
  minStock: z.number().int().min(0).optional(),
  isActive: z.boolean().default(true),
}).superRefine((value, ctx) => {
  if (!value.productId && (!value.categoryId || !value.unitId || !value.code || value.sellingPrice === undefined)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'categoryId, unitId, code, and sellingPrice are required when productId is omitted' });
  }
});

const tenantProductUpdateSchema = z.object({
  customName: z.string().trim().optional(),
  minStock: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  sellingPrice: z.coerce.number().nonnegative().optional(),
  purchasePrice: z.coerce.number().nonnegative().optional(),
});

export const listCatalog = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = z.object({ q: z.string().trim().optional(), includeInactive: z.coerce.boolean().default(false) }).parse(req.query);
    const catalog = await prisma.productCatalog.findMany({
      where: {
        ...(query.includeInactive ? {} : { isActive: true }),
        ...(query.q ? {
          OR: [
            { globalCode: { contains: query.q, mode: 'insensitive' } },
            { barcode: { contains: query.q, mode: 'insensitive' } },
            { name: { contains: query.q, mode: 'insensitive' } },
            { genericName: { contains: query.q, mode: 'insensitive' } },
            { composition: { contains: query.q, mode: 'insensitive' } },
          ],
        } : {}),
      },
      include: { categoryCatalog: true, defaultUnitCatalog: true },
      orderBy: { name: 'asc' },
    });

    return sendSuccess(res, catalog, 'Product catalog retrieved', 200, { count: catalog.length });
  } catch (error) {
    return next(error);
  }
};

export const createCatalog = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = catalogSchema.parse(req.body);
    const created = await prisma.$transaction(async (tx) => {
      const catalog = await tx.productCatalog.create({ data: payload, include: { categoryCatalog: true, defaultUnitCatalog: true } });
      await auditLog({
        tenantId: req.auth!.tenantId,
        actorId: req.auth!.userId,
        action: 'CREATE',
        entity: 'ProductCatalog',
        entityId: catalog.id,
        after: catalog,
        req,
      }, tx);
      return catalog;
    });

    return sendSuccess(res, created, 'Product catalog created', 201);
  } catch (error) {
    return next(error);
  }
};

export const updateCatalog = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const payload = catalogUpdateSchema.parse(req.body);
    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.productCatalog.findUniqueOrThrow({ where: { id } });
      const updated = await tx.productCatalog.update({ where: { id }, data: payload, include: { categoryCatalog: true, defaultUnitCatalog: true } });
      await auditLog({ tenantId: req.auth!.tenantId, actorId: req.auth!.userId, action: 'UPDATE', entity: 'ProductCatalog', entityId: id, before, after: updated, req }, tx);
      return updated;
    });
    return sendSuccess(res, result, 'Product catalog updated');
  } catch (error) {
    return next(error);
  }
};

export const deactivateCatalog = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.productCatalog.findUniqueOrThrow({ where: { id } });
      const updated = await tx.productCatalog.update({ where: { id }, data: { isActive: false } });
      await auditLog({ tenantId: req.auth!.tenantId, actorId: req.auth!.userId, action: 'UPDATE', entity: 'ProductCatalog', entityId: id, before, after: updated, req }, tx);
      return { id, deactivated: true };
    });
    return sendSuccess(res, result, 'Product catalog deactivated');
  } catch (error) {
    return next(error);
  }
};

export const listTenantProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getOptionalBranchId(req);
    const tenantProducts = await prisma.tenantProduct.findMany({
      where: { tenantId },
      include: { catalog: true, product: { include: { units: { include: { unit: true } } } } },
      orderBy: { createdAt: 'desc' },
    });

    const productIds = tenantProducts.map((tenantProduct) => tenantProduct.productId);
    const batches = productIds.length
      ? await prisma.productBatch.findMany({
          where: {
            tenantId,
            productId: { in: productIds },
            ...(branchId ? { branchId } : {}),
          },
          include: { location: true },
          orderBy: { expiredDate: 'asc' },
        })
      : [];
    const batchesByProduct = new Map<string, typeof batches>();
    for (const batch of batches) {
      const productBatches = batchesByProduct.get(batch.productId) ?? [];
      productBatches.push(batch);
      batchesByProduct.set(batch.productId, productBatches);
    }

    const enrichedTenantProducts = tenantProducts.map((tenantProduct) => {
      const productBatches = batchesByProduct.get(tenantProduct.productId) ?? [];
      const totalStock = productBatches.reduce((sum, batch) => sum + batch.stock, 0);
      const reservedStock = productBatches.reduce((sum, batch) => sum + batch.reservedStock, 0);
      const availableStock = productBatches.reduce(
        (sum, batch) => sum + Math.max(0, batch.stock - batch.reservedStock),
        0,
      );
      const locations = [...new Set(productBatches.map((batch) => batch.location?.name).filter(Boolean))];
      const nearestExpiredDate = productBatches[0]?.expiredDate ?? null;

      return {
        ...tenantProduct,
        branchId: branchId ?? null,
        stock: totalStock,
        totalStock,
        reservedStock,
        availableStock,
        batchCount: productBatches.length,
        nearestExpiredDate,
        locations,
        product: {
          ...tenantProduct.product,
          stock: totalStock,
          totalStock,
          reservedStock,
          availableStock,
          batchCount: productBatches.length,
          nearestExpiredDate,
          locations,
          batches: productBatches,
        },
      };
    });

    return sendSuccess(res, enrichedTenantProducts, 'Tenant products retrieved', 200, {
      count: enrichedTenantProducts.length,
      branchId: branchId ?? null,
    });
  } catch (error) {
    return next(error);
  }
};

export const activateTenantProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const payload = tenantProductSchema.parse(req.body);
    const result = await prisma.$transaction(async (tx) => {
      const catalog = await tx.productCatalog.findFirst({ where: { id: payload.catalogId, isActive: true } });
      if (!catalog) throw new HttpError('Active product catalog item not found', 404, 'CATALOG_ITEM_NOT_FOUND');

      let product = payload.productId
        ? await tx.product.findFirst({ where: { id: payload.productId, tenantId } })
        : null;
      if (payload.productId && !product) throw new HttpError('Product does not belong to the active tenant', 404, 'PRODUCT_NOT_FOUND');

      if (!product) {
        if (payload.conversion !== 1) {
          throw new HttpError('Initial product unit must be the base unit with conversion 1; add strip/box as an additional unit', 400, 'BASE_UNIT_CONVERSION_REQUIRED');
        }
        const category = await tx.category.findFirst({ where: { id: payload.categoryId, tenantId } });
        const unit = await tx.unit.findFirst({ where: { id: payload.unitId, tenantId } });
        if (!category || !unit || !payload.code || payload.sellingPrice === undefined) {
          throw new HttpError('Tenant category, unit, code, and sellingPrice are required', 400, 'TENANT_PRODUCT_CONFIG_REQUIRED');
        }
        product = await tx.product.create({
          data: {
            tenantId,
            catalogId: catalog.id,
            categoryId: category.id,
            defaultSupplierId: payload.defaultSupplierId,
            code: payload.code,
            barcode: catalog.barcode,
            name: payload.customName ?? catalog.name,
            genericName: catalog.genericName,
            brandName: catalog.brandName,
            registrationNumber: catalog.registrationNumber,
            dosageForm: catalog.dosageForm,
            strength: catalog.strength,
            composition: catalog.composition,
            manufacturer: catalog.manufacturer,
            principal: catalog.principal,
            productType: catalog.productType,
            controlledClass: catalog.controlledClass,
            minStock: payload.minStock ?? 10,
            status: payload.isActive ? 'ACTIVE' : 'INACTIVE',
            units: { create: {
              unitId: unit.id,
              conversion: payload.conversion,
              isBaseUnit: true,
              sellingPrice: payload.sellingPrice.toFixed(2),
              purchasePrice: payload.purchasePrice === undefined ? undefined : payload.purchasePrice.toFixed(2),
            } },
          },
        });
      }

      const mapping = await tx.tenantProduct.upsert({
        where: { productId: product.id },
        create: {
          tenantId,
          catalogId: payload.catalogId,
          productId: product.id,
          customName: payload.customName,
          minStock: payload.minStock,
          isActive: payload.isActive,
        },
        update: {
          catalogId: payload.catalogId,
          customName: payload.customName,
          minStock: payload.minStock,
          isActive: payload.isActive,
        },
        include: { catalog: true, product: true },
      });

      await tx.product.update({
        where: { id: product.id },
        data: {
          catalogId: catalog.id,
          ...(payload.customName ? { name: payload.customName } : {}),
          ...(payload.minStock === undefined ? {} : { minStock: payload.minStock }),
          status: payload.isActive ? 'ACTIVE' : 'INACTIVE',
        },
      });

      if (payload.sellingPrice !== undefined || payload.purchasePrice !== undefined) {
        const baseUnit = await tx.productUnit.findFirst({ where: { productId: product.id, isBaseUnit: true }, orderBy: { id: 'asc' } });
        if (baseUnit) await tx.productUnit.update({ where: { id: baseUnit.id }, data: {
          sellingPrice: payload.sellingPrice === undefined ? undefined : payload.sellingPrice.toFixed(2),
          purchasePrice: payload.purchasePrice === undefined ? undefined : payload.purchasePrice.toFixed(2),
        } });
      }

      await auditLog({
        tenantId,
        actorId: req.auth?.userId,
        action: 'UPDATE',
        entity: 'TenantProduct',
        entityId: mapping.id,
        after: mapping,
        req,
      }, tx);
      return mapping;
    });

    return sendSuccess(res, result, 'Tenant product activated', 201);
  } catch (error) {
    return next(error);
  }
};

export const updateTenantProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const id = z.string().uuid().parse(req.params.id);
    const payload = tenantProductUpdateSchema.parse(req.body);
    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.tenantProduct.findFirstOrThrow({ where: { id, tenantId }, include: { product: true } });
      const mapping = await tx.tenantProduct.update({ where: { id }, data: payload, include: { catalog: true, product: { include: { units: { include: { unit: true } } } } } });
      await tx.product.update({ where: { id: before.productId }, data: {
        ...(payload.customName === undefined ? {} : { name: payload.customName }),
        ...(payload.minStock === undefined ? {} : { minStock: payload.minStock }),
        ...(payload.isActive === undefined ? {} : { status: payload.isActive ? 'ACTIVE' : 'INACTIVE' }),
      } });
      if (payload.sellingPrice !== undefined || payload.purchasePrice !== undefined) {
        const baseUnit = await tx.productUnit.findFirst({ where: { productId: before.productId, isBaseUnit: true }, orderBy: { id: 'asc' } });
        if (baseUnit) await tx.productUnit.update({ where: { id: baseUnit.id }, data: {
          sellingPrice: payload.sellingPrice === undefined ? undefined : payload.sellingPrice.toFixed(2),
          purchasePrice: payload.purchasePrice === undefined ? undefined : payload.purchasePrice.toFixed(2),
        } });
      }
      await auditLog({ tenantId, actorId: req.auth?.userId, action: 'UPDATE', entity: 'TenantProduct', entityId: id, before, after: mapping, req }, tx);
      return mapping;
    });
    return sendSuccess(res, result, 'Tenant product updated');
  } catch (error) {
    return next(error);
  }
};

export const deactivateTenantProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const id = z.string().uuid().parse(req.params.id);
    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.tenantProduct.findFirstOrThrow({ where: { id, tenantId } });
      await tx.tenantProduct.update({ where: { id }, data: { isActive: false } });
      await tx.product.update({ where: { id: before.productId }, data: { status: 'INACTIVE' } });
      await auditLog({ tenantId, actorId: req.auth?.userId, action: 'UPDATE', entity: 'TenantProduct', entityId: id, before, after: { ...before, isActive: false }, req }, tx);
      return { id, deactivated: true };
    });
    return sendSuccess(res, result, 'Tenant product deactivated');
  } catch (error) {
    return next(error);
  }
};
