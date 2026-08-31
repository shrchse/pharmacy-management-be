import { Router } from 'express';
import { requireFeature, requirePermission } from '../../middlewares/auth.middleware';
import { closeShift, depositShift, getActiveShift, getShift, listShifts, openShift, verifyShift } from './cashierShift.controller';

const router = Router();

router.post('/cashier-shifts/open', requirePermission('pos.checkout'), requireFeature('inventory'), openShift);
router.get('/cashier-shifts/active', requirePermission('pos.checkout'), requireFeature('inventory'), getActiveShift);
router.get('/cashier-shifts', requirePermission('pos.checkout'), requireFeature('inventory'), listShifts);
router.get('/cashier-shifts/:id', requirePermission('pos.checkout'), requireFeature('inventory'), getShift);
router.post('/cashier-shifts/:id/close', requirePermission('pos.checkout'), requireFeature('inventory'), closeShift);
router.post('/cashier-shifts/:id/deposit', requirePermission('finance.manage'), requireFeature('finance'), depositShift);
router.post('/cashier-shifts/:id/verify', requirePermission('stock.adjust'), requireFeature('inventory'), verifyShift);

export default router;
