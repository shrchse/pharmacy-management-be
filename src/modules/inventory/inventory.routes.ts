import { Router } from 'express';
import { requirePermission } from '../../middlewares/auth.middleware';
import {
  closeOpname,
  createBatch,
  createOpname,
  defekta,
  internalMutation,
  listOpnames,
  reminderEd,
  stockCard,
  stockOverview,
} from './inventory.controller';

const router = Router();

router.get('/stock/overview', requirePermission('stock.read'), stockOverview);
router.get('/stock/defekta', requirePermission('stock.read'), defekta);
router.get('/stock/reminder-ed', requirePermission('stock.read'), reminderEd);
router.get('/products/:id/stock-card', requirePermission('stock.read'), stockCard);

router.post('/stock/batches', requirePermission('stock.adjust'), createBatch);
router.get('/stock/opname', requirePermission('stock.read'), listOpnames);
router.post('/stock/opname', requirePermission('stock.adjust'), createOpname);
router.post('/stock/opname/:id/close', requirePermission('stock.adjust'), closeOpname);
router.post('/stock/internal-mutations', requirePermission('stock.adjust'), internalMutation);

export default router;
