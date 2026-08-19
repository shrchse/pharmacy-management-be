import { NextFunction, Request, Response } from 'express';
import { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';
import { sendSuccess } from '../../utils/apiResponse';
import { getOptionalBranchId, getTenantId } from '../../utils/scope';

const money = (value: number) => value.toFixed(2);

const startOfDay = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const startOfMonth = () => {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
};

const branchScope = (tenantId: string, branchId?: string | null) => ({
  tenantId,
  ...(branchId ? { branchId } : {}),
});

const saleWhere = (tenantId: string, branchId?: string | null, start?: Date): Prisma.SaleWhereInput => ({
  ...branchScope(tenantId, branchId),
  status: 'COMPLETED',
  ...(start ? { createdAt: { gte: start } } : {}),
});

const saleItemWhere = (tenantId: string, branchId?: string | null, start?: Date): Prisma.SaleItemWhereInput => ({
  tenantId,
  sale: saleWhere(tenantId, branchId, start),
});

const getScope = (req: Request) => {
  return {
    tenantId: getTenantId(req),
    branchId: getOptionalBranchId(req),
  };
};

const getStockRisk = async (tenantId: string, branchId?: string | null) => {
  const batches = await prisma.productBatch.findMany({
    where: { ...branchScope(tenantId, branchId), status: 'AVAILABLE' },
    include: { product: true, location: true },
    orderBy: [{ product: { name: 'asc' } }, { expiredDate: 'asc' }],
  });

  const byProduct = new Map<string, {
    productId: string;
    code: string;
    name: string;
    stock: number;
    minStock: number;
    stockValue: number;
  }>();

  for (const batch of batches) {
    const current = byProduct.get(batch.productId) ?? {
      productId: batch.productId,
      code: batch.product.code,
      name: batch.product.name,
      stock: 0,
      minStock: batch.product.minStock,
      stockValue: 0,
    };
    current.stock += batch.stock;
    current.stockValue += batch.stock * Number(batch.buyPrice);
    byProduct.set(batch.productId, current);
  }

  const now = new Date();
  const expiryLimit = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  const lowStock = [...byProduct.values()].filter((item) => item.stock <= item.minStock);
  const expiringBatches = batches.filter((batch) => batch.stock > 0 && batch.expiredDate <= expiryLimit);
  const expiredBatches = batches.filter((batch) => batch.stock > 0 && batch.expiredDate < now);

  return {
    products: [...byProduct.values()],
    lowStock,
    expiringBatches,
    expiredBatches,
    stockValue: byProduct.size ? [...byProduct.values()].reduce((sum, item) => sum + item.stockValue, 0) : 0,
  };
};

const getFinanceRisk = async (tenantId: string, branchId?: string | null) => {
  const now = new Date();
  const [overdueDebts, overdueReceivables] = await Promise.all([
    prisma.debt.findMany({
      where: {
        ...branchScope(tenantId, branchId),
        status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] },
        dueDate: { lte: now },
      },
      include: { supplier: true },
      orderBy: { dueDate: 'asc' },
      take: 20,
    }),
    prisma.receivable.findMany({
      where: {
        ...branchScope(tenantId, branchId),
        status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] },
        dueDate: { lte: now },
      },
      include: { customer: true },
      orderBy: { dueDate: 'asc' },
      take: 20,
    }),
  ]);

  return { overdueDebts, overdueReceivables };
};

const buildRecommendations = (
  stock: Awaited<ReturnType<typeof getStockRisk>>,
  finance: Awaited<ReturnType<typeof getFinanceRisk>>
) => {
  const recommendations = [];
  if (stock.lowStock.length) {
    recommendations.push({
      code: 'REORDER_LOW_STOCK',
      priority: 'HIGH',
      message: 'Review defekta and create purchase orders for low-stock products.',
      count: stock.lowStock.length,
    });
  }
  if (stock.expiringBatches.length) {
    recommendations.push({
      code: 'HANDLE_EXPIRING_BATCHES',
      priority: stock.expiredBatches.length ? 'HIGH' : 'MEDIUM',
      message: 'Prioritize expiring batches for recall, promo, quarantine, or supplier return decisions.',
      count: stock.expiringBatches.length,
    });
  }
  if (finance.overdueReceivables.length) {
    recommendations.push({
      code: 'COLLECT_RECEIVABLES',
      priority: 'MEDIUM',
      message: 'Follow up overdue receivables to protect cash flow.',
      count: finance.overdueReceivables.length,
    });
  }
  if (finance.overdueDebts.length) {
    recommendations.push({
      code: 'SCHEDULE_DEBT_PAYMENTS',
      priority: 'MEDIUM',
      message: 'Schedule overdue debt payments or reconcile payment status.',
      count: finance.overdueDebts.length,
    });
  }
  return recommendations;
};

export const dashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, branchId } = getScope(req);
    const [todaySales, monthSales, monthCosts, cash, receivables, debts, stock] = await Promise.all([
      prisma.sale.aggregate({ where: saleWhere(tenantId, branchId, startOfDay()), _count: { id: true }, _sum: { grandTotal: true } }),
      prisma.sale.aggregate({ where: saleWhere(tenantId, branchId, startOfMonth()), _count: { id: true }, _sum: { grandTotal: true } }),
      prisma.saleItem.aggregate({ where: saleItemWhere(tenantId, branchId, startOfMonth()), _sum: { costAmount: true } }),
      prisma.cashAccount.aggregate({ where: { ...branchScope(tenantId, branchId), isActive: true }, _sum: { balance: true } }),
      prisma.receivable.aggregate({ where: { ...branchScope(tenantId, branchId), status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } }, _sum: { amount: true, paidAmount: true } }),
      prisma.debt.aggregate({ where: { ...branchScope(tenantId, branchId), status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } }, _sum: { amount: true, paidAmount: true } }),
      getStockRisk(tenantId, branchId),
    ]);

    const monthRevenue = Number(monthSales._sum.grandTotal ?? 0);
    const monthCogs = Number(monthCosts._sum.costAmount ?? 0);
    const receivableBalance = Number(receivables._sum.amount ?? 0) - Number(receivables._sum.paidAmount ?? 0);
    const debtBalance = Number(debts._sum.amount ?? 0) - Number(debts._sum.paidAmount ?? 0);

    return sendSuccess(res, {
      scope: { tenantId, branchId },
      sales: {
        todayRevenue: money(Number(todaySales._sum.grandTotal ?? 0)),
        todayTransactions: todaySales._count.id,
        monthRevenue: money(monthRevenue),
        monthTransactions: monthSales._count.id,
        monthGrossProfit: money(monthRevenue - monthCogs),
      },
      finance: {
        cashBalance: money(Number(cash._sum.balance ?? 0)),
        receivableBalance: money(receivableBalance),
        debtBalance: money(debtBalance),
      },
      inventory: {
        stockValue: money(stock.stockValue),
        lowStockCount: stock.lowStock.length,
        expiringBatchCount: stock.expiringBatches.length,
        expiredBatchCount: stock.expiredBatches.length,
      },
    }, 'Owner dashboard retrieved');
  } catch (error) {
    return next(error);
  }
};

export const dailyBrief = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, branchId } = getScope(req);
    const [stock, finance, sales] = await Promise.all([
      getStockRisk(tenantId, branchId),
      getFinanceRisk(tenantId, branchId),
      prisma.sale.aggregate({ where: saleWhere(tenantId, branchId, startOfDay()), _count: { id: true }, _sum: { grandTotal: true } }),
    ]);

    return sendSuccess(res, {
      date: startOfDay(),
      sales: {
        revenue: money(Number(sales._sum.grandTotal ?? 0)),
        transactions: sales._count.id,
      },
      warnings: {
        lowStock: stock.lowStock.slice(0, 10),
        expiringBatches: stock.expiringBatches.slice(0, 10),
        overdueDebts: finance.overdueDebts,
        overdueReceivables: finance.overdueReceivables,
      },
      recommendations: buildRecommendations(stock, finance),
    }, 'Owner daily brief retrieved');
  } catch (error) {
    return next(error);
  }
};

export const healthScore = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, branchId } = getScope(req);
    const [stock, finance, cash] = await Promise.all([
      getStockRisk(tenantId, branchId),
      getFinanceRisk(tenantId, branchId),
      prisma.cashAccount.aggregate({ where: { ...branchScope(tenantId, branchId), isActive: true }, _sum: { balance: true } }),
    ]);

    const penalties = {
      lowStock: Math.min(25, stock.lowStock.length * 3),
      expiring: Math.min(20, stock.expiringBatches.length * 2),
      overdueReceivables: Math.min(20, finance.overdueReceivables.length * 4),
      overdueDebts: Math.min(15, finance.overdueDebts.length * 3),
      negativeCash: Number(cash._sum.balance ?? 0) < 0 ? 20 : 0,
    };
    const score = Math.max(0, 100 - Object.values(penalties).reduce((sum, value) => sum + value, 0));

    return sendSuccess(res, { score, penalties }, 'Owner health score retrieved');
  } catch (error) {
    return next(error);
  }
};

export const warnings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, branchId } = getScope(req);
    const [stock, finance] = await Promise.all([getStockRisk(tenantId, branchId), getFinanceRisk(tenantId, branchId)]);

    return sendSuccess(res, {
      lowStock: stock.lowStock,
      expiringBatches: stock.expiringBatches,
      expiredBatches: stock.expiredBatches,
      overdueDebts: finance.overdueDebts,
      overdueReceivables: finance.overdueReceivables,
    }, 'Owner warnings retrieved');
  } catch (error) {
    return next(error);
  }
};

export const recommendations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, branchId } = getScope(req);
    const [stock, finance] = await Promise.all([getStockRisk(tenantId, branchId), getFinanceRisk(tenantId, branchId)]);
    return sendSuccess(res, buildRecommendations(stock, finance), 'Owner recommendations retrieved');
  } catch (error) {
    return next(error);
  }
};

export const auditControl = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, branchId } = getScope(req);
    const [latestWrites, cancelledSales, manualAdjustments] = await Promise.all([
      prisma.auditLog.findMany({
        where: { ...branchScope(tenantId, branchId), action: { in: ['CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'EXPORT'] } },
        include: { actor: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.sale.findMany({
        where: { ...branchScope(tenantId, branchId), status: 'CANCELLED' },
        include: { cashier: { select: { id: true, name: true, email: true } } },
        orderBy: { cancelledAt: 'desc' },
        take: 20,
      }),
      prisma.stockLedger.findMany({
        where: { ...branchScope(tenantId, branchId), type: 'MANUAL_ADJUST' },
        include: { product: true, batch: true, user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    return sendSuccess(res, { latestWrites, cancelledSales, manualAdjustments }, 'Owner audit control retrieved');
  } catch (error) {
    return next(error);
  }
};

export const inventoryAnalysis = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, branchId } = getScope(req);
    const stock = await getStockRisk(tenantId, branchId);
    return sendSuccess(res, {
      productCount: stock.products.length,
      stockValue: money(stock.stockValue),
      lowStock: stock.lowStock,
      expiringBatches: stock.expiringBatches,
      expiredBatches: stock.expiredBatches,
    }, 'Inventory analysis retrieved');
  } catch (error) {
    return next(error);
  }
};

export const paretoAnalysis = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, branchId } = getScope(req);
    const grouped = await prisma.saleItem.groupBy({
      by: ['productId'],
      where: saleItemWhere(tenantId, branchId, startOfMonth()),
      _sum: { subtotal: true, qty: true },
      orderBy: { _sum: { subtotal: 'desc' } },
      take: 20,
    });
    const products = await prisma.product.findMany({ where: { tenantId, id: { in: grouped.map((item) => item.productId) } } });
    const productsById = new Map(products.map((product) => [product.id, product]));
    const totalRevenue = grouped.reduce((sum, item) => sum + Number(item._sum.subtotal ?? 0), 0);

    return sendSuccess(res, grouped.map((item) => {
      const revenue = Number(item._sum.subtotal ?? 0);
      return {
        product: productsById.get(item.productId),
        qty: item._sum.qty ?? 0,
        revenue: money(revenue),
        contributionPercent: totalRevenue === 0 ? 0 : Number(((revenue / totalRevenue) * 100).toFixed(2)),
      };
    }), 'Pareto analysis retrieved');
  } catch (error) {
    return next(error);
  }
};

export const productMarginAnalysis = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, branchId } = getScope(req);
    const grouped = await prisma.saleItem.groupBy({
      by: ['productId'],
      where: saleItemWhere(tenantId, branchId, startOfMonth()),
      _sum: { subtotal: true, costAmount: true, qty: true },
      orderBy: { _sum: { subtotal: 'desc' } },
      take: 50,
    });
    const products = await prisma.product.findMany({ where: { tenantId, id: { in: grouped.map((item) => item.productId) } } });
    const productsById = new Map(products.map((product) => [product.id, product]));

    return sendSuccess(res, grouped.map((item) => {
      const revenue = Number(item._sum.subtotal ?? 0);
      const cost = Number(item._sum.costAmount ?? 0);
      const grossProfit = revenue - cost;
      return {
        product: productsById.get(item.productId),
        qty: item._sum.qty ?? 0,
        revenue: money(revenue),
        cost: money(cost),
        grossProfit: money(grossProfit),
        marginPercent: revenue === 0 ? 0 : Number(((grossProfit / revenue) * 100).toFixed(2)),
      };
    }), 'Product margin analysis retrieved');
  } catch (error) {
    return next(error);
  }
};

export const supplierPurchasesAnalysis = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, branchId } = getScope(req);
    const grouped = await prisma.purchase.groupBy({
      by: ['supplierId'],
      where: {
        ...branchScope(tenantId, branchId),
        status: { in: ['ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED'] },
        createdAt: { gte: startOfMonth() },
      },
      _count: { id: true },
      _sum: { grandTotal: true },
      orderBy: { _sum: { grandTotal: 'desc' } },
      take: 20,
    });
    const suppliers = await prisma.supplier.findMany({ where: { tenantId, id: { in: grouped.map((item) => item.supplierId) } } });
    const suppliersById = new Map(suppliers.map((supplier) => [supplier.id, supplier]));

    return sendSuccess(res, grouped.map((item) => ({
      supplier: suppliersById.get(item.supplierId),
      purchaseCount: item._count.id,
      totalPurchase: money(Number(item._sum.grandTotal ?? 0)),
    })), 'Supplier purchases analysis retrieved');
  } catch (error) {
    return next(error);
  }
};
