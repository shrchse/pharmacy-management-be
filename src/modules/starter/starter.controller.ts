import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { resolveBranchId, resolveTenantId } from '../../middlewares/auth.middleware';
import { sendSuccess } from '../../utils/apiResponse';

const uuidParamSchema = z.object({
  tenantId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
});

const tenantScopeSchema = z.object({
  tenantId: z.string({ required_error: 'tenantId is required' }).uuid('tenantId must be a valid UUID'),
});

const branchScopeSchema = z.object({
  branchId: z.string({ required_error: 'branchId is required' }).uuid('branchId must be a valid UUID'),
});

const createTenantSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  email: z.string().email(),
  phone: z.string().optional(),
  address: z.string().optional(),
  taxId: z.string().optional(),
});

const createBranchSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  businessCategory: z.enum(['APOTEK', 'TOKO_OBAT', 'KLINIK', 'PBF', 'DISTRIBUTOR']).default('APOTEK'),
  phone: z.string().optional(),
  address: z.string().optional(),
  siaNumber: z.string().optional(),
  apjName: z.string().optional(),
  apjSipaNumber: z.string().optional(),
});

const createCategorySchema = z.object({
  name: z.string().min(1),
  type: z.enum([
    'OBAT_BEBAS',
    'OBAT_BEBAS_TERBATAS',
    'OBAT_KERAS',
    'PSIKOTROPIKA',
    'NARKOTIKA',
    'ALKES',
    'BMHP',
    'KOSMETIK',
    'UMUM',
  ]).default('OBAT_BEBAS'),
});

const createUnitSchema = z.object({
  tenantId: z.string().uuid().optional(),
  code: z.string().min(1),
  name: z.string().min(1),
});

const createProductSchema = z.object({
  tenantId: z.string().uuid().optional(),
  categoryId: z.string().uuid(),
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
  productType: z.enum(['MEDICINE', 'MEDICAL_DEVICE', 'CONSUMABLE', 'COSMETIC', 'GENERAL', 'COMPOUND']).default('MEDICINE'),
  controlledClass: z.enum(['NONE', 'OBAT_KERAS', 'PSIKOTROPIKA', 'NARKOTIKA']).default('NONE'),
  requiresPrescription: z.boolean().default(false),
  minStock: z.number().int().min(0).default(10),
  unitId: z.string().uuid(),
  conversion: z.number().int().positive().default(1),
  sellingPrice: z.coerce.number().nonnegative(),
  purchasePrice: z.coerce.number().nonnegative().optional(),
});

const createBatchSchema = z.object({
  tenantId: z.string().uuid().optional(),
  productId: z.string().uuid(),
  batchNumber: z.string().min(1),
  expiredDate: z.coerce.date(),
  buyPrice: z.coerce.number().nonnegative(),
  stock: z.number().int().min(0),
  locationId: z.string().uuid().optional(),
});

const checkoutSchema = z.object({
  tenantId: z.string().uuid().optional(),
  cashierId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
  saleType: z.enum(['REGULAR', 'PRESCRIPTION', 'COMPOUND']).default('REGULAR'),
  channel: z.enum(['OFFLINE', 'WHATSAPP', 'MARKETPLACE', 'ONLINE_STORE', 'MOBILE_OFFLINE']).default('OFFLINE'),
  discountAmount: z.coerce.number().nonnegative().default(0),
  taxAmount: z.coerce.number().nonnegative().default(0),
  items: z.array(z.object({
    productId: z.string().uuid(),
    productUnitId: z.string().uuid(),
    batchId: z.string().uuid().optional(),
    qty: z.number().int().positive(),
    unitPrice: z.coerce.number().nonnegative().optional(),
    discountAmount: z.coerce.number().nonnegative().default(0),
  })).min(1),
  payments: z.array(z.object({
    method: z.enum(['CASH', 'QRIS', 'DEBIT_CARD', 'CREDIT_CARD', 'TRANSFER', 'E_WALLET', 'CREDIT']),
    amount: z.coerce.number().nonnegative(),
    referenceNo: z.string().optional(),
  })).default([]),
});

const money = (value: number) => value.toFixed(2);

const invoiceNumber = () => {
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `INV-${stamp}-${suffix}`;
};

export const listTenants = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const tenants = await prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: { branches: true, plan: true },
    });

    return sendSuccess(res, tenants, 'Tenants retrieved');
  } catch (error) {
    return next(error);
  }
};

export const starterIndex = (_req: Request, res: Response) => {
  return sendSuccess(
    res,
    {
      tenants: {
        list: 'GET /api/v1/tenants',
        create: 'POST /api/v1/tenants',
      },
      branches: {
        list: 'GET /api/v1/branches',
        listByTenant: 'GET /api/v1/tenants/:tenantId/branches',
        create: 'POST /api/v1/tenants/:tenantId/branches',
      },
      products: {
        list: 'GET /api/v1/products',
        listByTenant: 'GET /api/v1/tenants/:tenantId/products',
        create: 'POST /api/v1/products',
      },
      stock: {
        overview: 'GET /api/v1/branches/:branchId/stock/overview',
        createBatch: 'POST /api/v1/branches/:branchId/stock/batches',
      },
      pos: {
        checkout: 'POST /api/v1/branches/:branchId/pos/checkout',
      },
    },
    'Starter endpoints'
  );
};

export const createTenant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = createTenantSchema.parse(req.body);
    const tenant = await prisma.tenant.create({ data: payload });

    return sendSuccess(res, tenant, 'Tenant created', 201);
  } catch (error) {
    return next(error);
  }
};

export const listBranches = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = tenantScopeSchema.parse({
      tenantId: resolveTenantId(req),
    });
    const branches = await prisma.branch.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return sendSuccess(res, branches, 'Branches retrieved');
  } catch (error) {
    return next(error);
  }
};

export const createBranch = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = uuidParamSchema.required({ tenantId: true }).parse(req.params);
    const payload = createBranchSchema.parse(req.body);
    const branch = await prisma.branch.create({
      data: {
        tenantId,
        ...payload,
      },
    });

    return sendSuccess(res, branch, 'Branch created', 201);
  } catch (error) {
    return next(error);
  }
};

export const createCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = uuidParamSchema.required({ tenantId: true }).parse(req.params);
    const payload = createCategorySchema.parse(req.body);
    const category = await prisma.category.create({
      data: {
        tenantId,
        ...payload,
      },
    });

    return sendSuccess(res, category, 'Category created', 201);
  } catch (error) {
    return next(error);
  }
};

export const createUnit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = createUnitSchema.parse(req.body);
    const { tenantId } = tenantScopeSchema.parse({
      tenantId: payload.tenantId ?? resolveTenantId(req),
    });
    const unit = await prisma.unit.create({
      data: {
        tenantId,
        code: payload.code,
        name: payload.name,
      },
    });

    return sendSuccess(res, unit, 'Unit created', 201);
  } catch (error) {
    return next(error);
  }
};

export const listProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = tenantScopeSchema.parse({
      tenantId: resolveTenantId(req),
    });
    const products = await prisma.product.findMany({
      where: { tenantId },
      include: {
        category: true,
        units: { include: { unit: true } },
      },
      orderBy: { name: 'asc' },
    });

    return sendSuccess(res, products, 'Products retrieved');
  } catch (error) {
    return next(error);
  }
};

export const createProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = createProductSchema.parse(req.body);
    const { tenantId } = tenantScopeSchema.parse({
      tenantId: payload.tenantId ?? resolveTenantId(req),
    });
    const product = await prisma.product.create({
      data: {
        tenantId,
        categoryId: payload.categoryId,
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
        productType: payload.productType,
        controlledClass: payload.controlledClass,
        requiresPrescription: payload.requiresPrescription,
        minStock: payload.minStock,
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
      include: { units: { include: { unit: true } }, category: true },
    });

    return sendSuccess(res, product, 'Product created', 201);
  } catch (error) {
    return next(error);
  }
};

export const createBatch = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = createBatchSchema.parse(req.body);
    const { tenantId } = tenantScopeSchema.parse({
      tenantId: payload.tenantId ?? resolveTenantId(req),
    });
    const { branchId } = branchScopeSchema.parse({
      branchId: resolveBranchId(req),
    });
    const batch = await prisma.productBatch.create({
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

    return sendSuccess(res, batch, 'Product batch created', 201);
  } catch (error) {
    return next(error);
  }
};

export const stockOverview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { branchId } = branchScopeSchema.parse({ branchId: resolveBranchId(req) });
    const { tenantId } = tenantScopeSchema.parse({ tenantId: resolveTenantId(req) });
    const batches = await prisma.productBatch.findMany({
      where: { tenantId, branchId },
      include: { product: true },
      orderBy: [{ product: { name: 'asc' } }, { expiredDate: 'asc' }],
    });

    const overview = batches.reduce<Record<string, {
      productId: string;
      code: string;
      name: string;
      totalStock: number;
      minStock: number;
      nearestExpiredDate: Date | null;
    }>>((acc, batch) => {
      const current = acc[batch.productId] ?? {
        productId: batch.productId,
        code: batch.product.code,
        name: batch.product.name,
        totalStock: 0,
        minStock: batch.product.minStock,
        nearestExpiredDate: null,
      };

      current.totalStock += batch.stock;
      current.nearestExpiredDate =
        current.nearestExpiredDate && current.nearestExpiredDate < batch.expiredDate
          ? current.nearestExpiredDate
          : batch.expiredDate;
      acc[batch.productId] = current;
      return acc;
    }, {});

    return sendSuccess(res, Object.values(overview), 'Stock overview retrieved');
  } catch (error) {
    return next(error);
  }
};

export const checkout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = checkoutSchema.parse(req.body);
    const { tenantId } = tenantScopeSchema.parse({
      tenantId: payload.tenantId ?? resolveTenantId(req),
    });
    const { branchId } = branchScopeSchema.parse({
      branchId: resolveBranchId(req),
    });
    const cashierId = z.string({ required_error: 'cashierId is required' }).uuid().parse(
      payload.cashierId ?? req.auth?.userId
    );

    const sale = await prisma.$transaction(async (tx) => {
      const productUnits = await tx.productUnit.findMany({
        where: { id: { in: payload.items.map((item) => item.productUnitId) } },
      });
      const unitById = new Map(productUnits.map((unit) => [unit.id, unit]));

      const saleItems = [];
      let totalAmount = 0;
      let costAmount = 0;

      for (const item of payload.items) {
        const productUnit = unitById.get(item.productUnitId);
        if (!productUnit) {
          throw new Error(`Product unit not found: ${item.productUnitId}`);
        }

        const baseQty = item.qty * productUnit.conversion;
        const batch = item.batchId
          ? await tx.productBatch.findFirst({
              where: {
                id: item.batchId,
                tenantId,
                branchId,
                productId: item.productId,
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

        if (!batch || batch.stock < baseQty) {
          throw new Error(`Insufficient stock for product: ${item.productId}`);
        }

        const unitPrice = item.unitPrice ?? Number(productUnit.sellingPrice);
        const subtotal = item.qty * unitPrice - item.discountAmount;
        totalAmount += subtotal;
        costAmount += baseQty * Number(batch.buyPrice);

        await tx.productBatch.update({
          where: { id: batch.id },
          data: { stock: { decrement: baseQty } },
        });

        saleItems.push({
          tenantId,
          productId: item.productId,
          productUnitId: item.productUnitId,
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

      const grandTotal = totalAmount - payload.discountAmount + payload.taxAmount;
      const paidAmount = payload.payments.reduce((sum, payment) => sum + payment.amount, 0);

      const createdSale = await tx.sale.create({
        data: {
          tenantId,
          branchId,
          invoiceNumber: invoiceNumber(),
          channel: payload.channel,
          sessionId: payload.sessionId,
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
          saleItems: true,
          payments: true,
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
          notes: 'POS checkout',
        })),
      });

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

      return { ...createdSale, grossProfit: money(totalAmount - costAmount) };
    });

    return sendSuccess(res, sale, 'Checkout completed', 201);
  } catch (error) {
    return next(error);
  }
};
