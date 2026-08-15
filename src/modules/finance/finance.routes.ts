import { Router } from 'express';
import { requirePermission } from '../../middlewares/auth.middleware';
import {
  agingDebts,
  agingReceivables,
  balanceSheet,
  cashFlow,
  createCashAccount,
  createCashMutation,
  createExpense,
  listCashAccounts,
  listCashMutations,
  listDebts,
  listReceivables,
  payDebt,
  payReceivable,
  pnl,
  ratios,
} from './finance.controller';

const router = Router();

router.get('/cash', requirePermission('finance.manage'), listCashAccounts);
router.post('/cash', requirePermission('finance.manage'), createCashAccount);
router.get('/cash/mutations', requirePermission('finance.manage'), listCashMutations);
router.post('/cash/mutations', requirePermission('finance.manage'), createCashMutation);

router.get('/debts', requirePermission('finance.manage'), listDebts);
router.post('/debts/:id/pay', requirePermission('finance.manage'), payDebt);
router.get('/receivables', requirePermission('finance.manage'), listReceivables);
router.post('/receivables/:id/pay', requirePermission('finance.manage'), payReceivable);
router.post('/expenses', requirePermission('finance.manage'), createExpense);

router.get('/finance/pnl', requirePermission('finance.manage'), pnl);
router.get('/finance/cash-flow', requirePermission('finance.manage'), cashFlow);
router.get('/finance/balance-sheet', requirePermission('finance.manage'), balanceSheet);
router.get('/finance/ratios', requirePermission('finance.manage'), ratios);
router.get('/finance/aging-debts', requirePermission('finance.manage'), agingDebts);
router.get('/finance/aging-receivables', requirePermission('finance.manage'), agingReceivables);

export default router;
