import { Router } from 'express';
import { requireFeature, requirePermission } from '../../middlewares/auth.middleware';
import {
  closeOpname,
  createBatch,
  createOpname,
  defekta,
  getOpnameItems,
  internalMutation,
  listInternalMutations,
  listOpnames,
  reminderEd,
  stockCard,
  stockOverview,
  updateOpname,
  updatePhysicalCounts,
} from './inventory.controller';

const router = Router();

router.get('/stock/overview', requirePermission('stock.read'), requireFeature('inventory'), stockOverview);
router.get('/stock/defekta', requirePermission('stock.read'), requireFeature('inventory'), defekta);
router.get('/stock/reminder-ed', requirePermission('stock.read'), requireFeature('inventory'), reminderEd);
router.get('/products/:id/stock-card', requirePermission('stock.read'), requireFeature('inventory'), stockCard);

router.post('/stock/batches', requirePermission('stock.adjust'), requireFeature('inventory'), createBatch);
router.get('/stock/opname', requirePermission('stock.read'), requireFeature('inventory'), listOpnames);
router.post('/stock/opname', requirePermission('stock.adjust'), requireFeature('inventory'), createOpname);
router.get('/stock/opname/:id/items', requirePermission('stock.read'), requireFeature('inventory'), getOpnameItems);
router.patch('/stock/opname/:id', requirePermission('stock.adjust'), requireFeature('inventory'), updateOpname);
router.put('/stock/opname/:id/physical-counts', requirePermission('stock.adjust'), requireFeature('inventory'), updatePhysicalCounts);
router.post('/stock/opname/:id/close', requirePermission('stock.adjust'), requireFeature('inventory'), closeOpname);
router.post('/stock/internal-mutations', requirePermission('stock.adjust'), requireFeature('inventory'), internalMutation);
router.get('/stock/internal-mutations', requirePermission('stock.read'), requireFeature('inventory'), listInternalMutations);

export default router;
