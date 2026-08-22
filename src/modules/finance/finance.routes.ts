import { Router } from 'express';
import { requireFeature, requirePermission } from '../../middlewares/auth.middleware';
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

router.get('/cash', requirePermission('finance.manage'), requireFeature('finance'), listCashAccounts);
router.post('/cash', requirePermission('finance.manage'), requireFeature('finance'), createCashAccount);
router.get('/cash/mutations', requirePermission('finance.manage'), requireFeature('finance'), listCashMutations);
router.post('/cash/mutations', requirePermission('finance.manage'), requireFeature('finance'), createCashMutation);

router.get('/debts', requirePermission('finance.manage'), requireFeature('finance'), listDebts);
router.post('/debts/:id/pay', requirePermission('finance.manage'), requireFeature('finance'), payDebt);
router.post('/debts/:id/payments', requirePermission('finance.manage'), requireFeature('finance'), payDebt);
router.get('/receivables', requirePermission('finance.manage'), requireFeature('finance'), listReceivables);
router.post('/receivables/:id/pay', requirePermission('finance.manage'), requireFeature('finance'), payReceivable);
router.post('/receivables/:id/payments', requirePermission('finance.manage'), requireFeature('finance'), payReceivable);
router.post('/expenses', requirePermission('finance.manage'), requireFeature('finance'), createExpense);

router.get('/finance/pnl', requirePermission('finance.manage'), requireFeature('finance'), pnl);
router.get('/finance/cash-flow', requirePermission('finance.manage'), requireFeature('finance'), cashFlow);
router.get('/finance/balance-sheet', requirePermission('finance.manage'), requireFeature('finance'), balanceSheet);
router.get('/finance/ratios', requirePermission('finance.manage'), requireFeature('finance'), ratios);
router.get('/finance/aging-debts', requirePermission('finance.manage'), requireFeature('finance'), agingDebts);
router.get('/finance/aging-receivables', requirePermission('finance.manage'), requireFeature('finance'), agingReceivables);

export default router;
