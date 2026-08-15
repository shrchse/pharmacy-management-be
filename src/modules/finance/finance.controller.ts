import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { auditLog } from '../../lib/audit';
import { prisma } from '../../lib/prisma';
import { HttpError, sendSuccess } from '../../utils/apiResponse';
import { getBranchId, getTenantId, getOptionalBranchId } from '../../utils/scope';

const money = (value: number) => value.toFixed(2);

const idParamSchema = z.object({
  id: z.string().uuid(),
});

const cashAccountSchema = z.object({
  branchId: z.string().uuid().optional(),
  code: z.string().min(1),
  name: z.string().min(1),
  openingBalance: z.coerce.number().nonnegative().default(0),
});

const cashMutationSchema = z.object({
  branchId: z.string().uuid().optional(),
  cashAccountId: z.string().uuid(),
  type: z.enum(['CASH_IN', 'CASH_OUT', 'CASH_TRANSFER', 'OPENING_BALANCE', 'EXPENSE']),
  amount: z.coerce.number().nonnegative(),
  notes: z.string().optional(),
});

const paymentSchema = z.object({
  cashAccountId: z.string().uuid(),
  paymentMethod: z.enum(['CASH', 'QRIS', 'DEBIT_CARD', 'CREDIT_CARD', 'TRANSFER', 'E_WALLET', 'CREDIT']).default('CASH'),
  amount: z.coerce.number().positive(),
  referenceNo: z.string().optional(),
});

const expenseSchema = z.object({
  branchId: z.string().uuid().optional(),
  cashAccountId: z.string().uuid().optional(),
  category: z.string().min(1),
  amount: z.coerce.number().positive(),
  description: z.string().optional(),
  spentAt: z.coerce.date().optional(),
});

export const listCashAccounts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getOptionalBranchId(req);
    const accounts = await prisma.cashAccount.findMany({
      where: { tenantId, branchId },
      include: { branch: true },
      orderBy: { code: 'asc' },
    });

    return sendSuccess(res, accounts, 'Cash accounts retrieved', 200, { count: accounts.length });
  } catch (error) {
    return next(error);
  }
};

export const createCashAccount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const payload = cashAccountSchema.parse(req.body);
    const account = await prisma.$transaction(async (tx) => {
      const created = await tx.cashAccount.create({
        data: {
          tenantId,
          branchId: payload.branchId,
          code: payload.code,
          name: payload.name,
          balance: money(payload.openingBalance),
        },
      });

      if (payload.openingBalance > 0) {
        await tx.cashMutation.create({
          data: {
            tenantId,
            branchId: payload.branchId,
            cashAccountId: created.id,
            type: 'OPENING_BALANCE',
            amount: money(payload.openingBalance),
            notes: 'Opening balance',
            createdById: req.auth?.userId,
          },
        });
      }

      await auditLog({ tenantId, branchId: payload.branchId, actorId: req.auth?.userId, action: 'CREATE', entity: 'CashAccount', entityId: created.id, after: created, req }, tx);
      return created;
    });

    return sendSuccess(res, account, 'Cash account created', 201);
  } catch (error) {
    return next(error);
  }
};

export const listCashMutations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getOptionalBranchId(req);
    const mutations = await prisma.cashMutation.findMany({
      where: { tenantId, branchId },
      include: { cashAccount: true, createdBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return sendSuccess(res, mutations, 'Cash mutations retrieved', 200, { count: mutations.length });
  } catch (error) {
    return next(error);
  }
};

export const createCashMutation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const payload = cashMutationSchema.parse(req.body);
    const sign = payload.type === 'CASH_OUT' || payload.type === 'EXPENSE' ? -1 : 1;
    const mutation = await prisma.$transaction(async (tx) => {
      const account = await tx.cashAccount.findFirstOrThrow({ where: { id: payload.cashAccountId, tenantId } });
      const created = await tx.cashMutation.create({
        data: {
          tenantId,
          branchId: payload.branchId ?? account.branchId,
          cashAccountId: account.id,
          type: payload.type,
          amount: money(payload.amount),
          notes: payload.notes,
          createdById: req.auth?.userId,
        },
      });
      await tx.cashAccount.update({
        where: { id: account.id },
        data: { balance: { increment: sign * payload.amount } },
      });
      await auditLog({ tenantId, branchId: payload.branchId ?? account.branchId, actorId: req.auth?.userId, action: 'CREATE', entity: 'CashMutation', entityId: created.id, after: created, req }, tx);
      return created;
    });

    return sendSuccess(res, mutation, 'Cash mutation created', 201);
  } catch (error) {
    return next(error);
  }
};

export const listDebts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const debts = await prisma.debt.findMany({
      where: { tenantId, branchId },
      include: { supplier: true, purchase: true, payments: true },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
    });

    return sendSuccess(res, debts, 'Debts retrieved', 200, { count: debts.length });
  } catch (error) {
    return next(error);
  }
};

export const payDebt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const { id } = idParamSchema.parse(req.params);
    const payload = paymentSchema.parse(req.body);
    const result = await prisma.$transaction(async (tx) => {
      const debt = await tx.debt.findFirstOrThrow({ where: { id, tenantId, branchId } });
      const nextPaid = Number(debt.paidAmount) + payload.amount;
      if (nextPaid > Number(debt.amount)) throw new HttpError('Debt payment exceeds remaining amount', 409, 'PAYMENT_EXCEEDS_DEBT');

      const payment = await tx.debtPayment.create({
        data: {
          tenantId,
          debtId: debt.id,
          paymentMethod: payload.paymentMethod,
          amount: money(payload.amount),
          referenceNo: payload.referenceNo,
        },
      });
      const updatedDebt = await tx.debt.update({
        where: { id: debt.id },
        data: {
          paidAmount: money(nextPaid),
          status: nextPaid >= Number(debt.amount) ? 'PAID' : 'PARTIAL',
        },
      });
      await tx.cashMutation.create({
        data: {
          tenantId,
          branchId,
          cashAccountId: payload.cashAccountId,
          type: 'DEBT_PAYMENT',
          amount: money(payload.amount),
          refType: 'Debt',
          refId: debt.id,
          notes: `Debt payment ${debt.invoiceNo}`,
          createdById: req.auth?.userId,
        },
      });
      await tx.cashAccount.update({ where: { id: payload.cashAccountId }, data: { balance: { decrement: payload.amount } } });
      await auditLog({ tenantId, branchId, actorId: req.auth?.userId, action: 'UPDATE', entity: 'Debt', entityId: debt.id, before: debt, after: updatedDebt, metadata: { paymentId: payment.id }, req }, tx);
      return { debt: updatedDebt, payment };
    });

    return sendSuccess(res, result, 'Debt payment recorded');
  } catch (error) {
    return next(error);
  }
};

export const listReceivables = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const receivables = await prisma.receivable.findMany({
      where: { tenantId, branchId },
      include: { customer: true, sale: true, payments: true },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
    });

    return sendSuccess(res, receivables, 'Receivables retrieved', 200, { count: receivables.length });
  } catch (error) {
    return next(error);
  }
};

export const payReceivable = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const { id } = idParamSchema.parse(req.params);
    const payload = paymentSchema.parse(req.body);
    const result = await prisma.$transaction(async (tx) => {
      const receivable = await tx.receivable.findFirstOrThrow({ where: { id, tenantId, branchId } });
      const nextPaid = Number(receivable.paidAmount) + payload.amount;
      if (nextPaid > Number(receivable.amount)) throw new HttpError('Receivable payment exceeds remaining amount', 409, 'PAYMENT_EXCEEDS_RECEIVABLE');

      const payment = await tx.receivablePayment.create({
        data: {
          tenantId,
          receivableId: receivable.id,
          paymentMethod: payload.paymentMethod,
          amount: money(payload.amount),
          referenceNo: payload.referenceNo,
        },
      });
      const updatedReceivable = await tx.receivable.update({
        where: { id: receivable.id },
        data: {
          paidAmount: money(nextPaid),
          status: nextPaid >= Number(receivable.amount) ? 'PAID' : 'PARTIAL',
        },
      });
      await tx.cashMutation.create({
        data: {
          tenantId,
          branchId,
          cashAccountId: payload.cashAccountId,
          type: 'RECEIVABLE_PAYMENT',
          amount: money(payload.amount),
          refType: 'Receivable',
          refId: receivable.id,
          notes: `Receivable payment ${receivable.invoiceNo}`,
          createdById: req.auth?.userId,
        },
      });
      await tx.cashAccount.update({ where: { id: payload.cashAccountId }, data: { balance: { increment: payload.amount } } });
      await auditLog({ tenantId, branchId, actorId: req.auth?.userId, action: 'UPDATE', entity: 'Receivable', entityId: receivable.id, before: receivable, after: updatedReceivable, metadata: { paymentId: payment.id }, req }, tx);
      return { receivable: updatedReceivable, payment };
    });

    return sendSuccess(res, result, 'Receivable payment recorded');
  } catch (error) {
    return next(error);
  }
};

export const createExpense = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const payload = expenseSchema.parse(req.body);
    const expense = await prisma.$transaction(async (tx) => {
      const created = await tx.expense.create({
        data: {
          tenantId,
          branchId: payload.branchId,
          cashAccountId: payload.cashAccountId,
          category: payload.category,
          amount: money(payload.amount),
          description: payload.description,
          spentAt: payload.spentAt,
          createdById: req.auth?.userId,
        },
      });
      if (payload.cashAccountId) {
        await tx.cashMutation.create({
          data: {
            tenantId,
            branchId: payload.branchId,
            cashAccountId: payload.cashAccountId,
            type: 'EXPENSE',
            amount: money(payload.amount),
            refType: 'Expense',
            refId: created.id,
            notes: payload.description,
            createdById: req.auth?.userId,
          },
        });
        await tx.cashAccount.update({ where: { id: payload.cashAccountId }, data: { balance: { decrement: payload.amount } } });
      }
      await auditLog({ tenantId, branchId: payload.branchId, actorId: req.auth?.userId, action: 'CREATE', entity: 'Expense', entityId: created.id, after: created, req }, tx);
      return created;
    });

    return sendSuccess(res, expense, 'Expense created', 201);
  } catch (error) {
    return next(error);
  }
};

export const pnl = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const [sales, saleItems, expenses] = await Promise.all([
      prisma.sale.aggregate({ where: { tenantId, branchId, status: 'COMPLETED' }, _sum: { grandTotal: true } }),
      prisma.saleItem.aggregate({ where: { tenantId, sale: { branchId, status: 'COMPLETED' } }, _sum: { costAmount: true } }),
      prisma.expense.aggregate({ where: { tenantId, branchId }, _sum: { amount: true } }),
    ]);
    const revenue = Number(sales._sum.grandTotal ?? 0);
    const cogs = Number(saleItems._sum.costAmount ?? 0);
    const expense = Number(expenses._sum.amount ?? 0);
    const grossProfit = revenue - cogs;
    const netProfit = grossProfit - expense;

    return sendSuccess(res, {
      revenue: money(revenue),
      cogs: money(cogs),
      grossProfit: money(grossProfit),
      expenses: money(expense),
      netProfit: money(netProfit),
    }, 'P&L report retrieved');
  } catch (error) {
    return next(error);
  }
};

export const cashFlow = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const mutations = await prisma.cashMutation.groupBy({
      by: ['type'],
      where: { tenantId, branchId },
      _sum: { amount: true },
    });

    return sendSuccess(res, mutations.map((mutation) => ({
      type: mutation.type,
      amount: money(Number(mutation._sum.amount ?? 0)),
    })), 'Cash flow retrieved');
  } catch (error) {
    return next(error);
  }
};

export const balanceSheet = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const [cash, receivables, debts] = await Promise.all([
      prisma.cashAccount.aggregate({ where: { tenantId, branchId }, _sum: { balance: true } }),
      prisma.receivable.aggregate({ where: { tenantId, branchId, status: { in: ['UNPAID', 'PARTIAL'] } }, _sum: { amount: true, paidAmount: true } }),
      prisma.debt.aggregate({ where: { tenantId, branchId, status: { in: ['UNPAID', 'PARTIAL'] } }, _sum: { amount: true, paidAmount: true } }),
    ]);
    const cashBalance = Number(cash._sum.balance ?? 0);
    const receivableBalance = Number(receivables._sum.amount ?? 0) - Number(receivables._sum.paidAmount ?? 0);
    const debtBalance = Number(debts._sum.amount ?? 0) - Number(debts._sum.paidAmount ?? 0);

    return sendSuccess(res, {
      assets: {
        cash: money(cashBalance),
        receivables: money(receivableBalance),
      },
      liabilities: {
        debts: money(debtBalance),
      },
      equityApproximation: money(cashBalance + receivableBalance - debtBalance),
    }, 'Balance sheet summary retrieved');
  } catch (error) {
    return next(error);
  }
};

export const ratios = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const [sales, saleItems] = await Promise.all([
      prisma.sale.aggregate({ where: { tenantId, branchId, status: 'COMPLETED' }, _sum: { grandTotal: true } }),
      prisma.saleItem.aggregate({ where: { tenantId, sale: { branchId, status: 'COMPLETED' } }, _sum: { costAmount: true } }),
    ]);
    const revenue = Number(sales._sum.grandTotal ?? 0);
    const cogs = Number(saleItems._sum.costAmount ?? 0);
    const grossMargin = revenue === 0 ? 0 : ((revenue - cogs) / revenue) * 100;

    return sendSuccess(res, { grossMarginPercent: Number(grossMargin.toFixed(2)) }, 'Finance ratios retrieved');
  } catch (error) {
    return next(error);
  }
};

export const agingDebts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const debts = await prisma.debt.findMany({ where: { tenantId, branchId, status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } }, include: { supplier: true } });
    return sendSuccess(res, debts, 'Aging debts retrieved', 200, { count: debts.length });
  } catch (error) {
    return next(error);
  }
};

export const agingReceivables = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const branchId = getBranchId(req);
    const receivables = await prisma.receivable.findMany({ where: { tenantId, branchId, status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } }, include: { customer: true } });
    return sendSuccess(res, receivables, 'Aging receivables retrieved', 200, { count: receivables.length });
  } catch (error) {
    return next(error);
  }
};
