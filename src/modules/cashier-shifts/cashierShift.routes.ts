import { Router } from 'express';
import { requirePermission } from '../../middlewares/auth.middleware';
import { closeShift, depositShift, getShift, openShift, verifyShift } from './cashierShift.controller';

const router = Router();

router.post('/cashier-shifts/open', requirePermission('pos.checkout'), openShift);
router.get('/cashier-shifts/:id', requirePermission('pos.checkout'), getShift);
router.post('/cashier-shifts/:id/close', requirePermission('pos.checkout'), closeShift);
router.post('/cashier-shifts/:id/deposit', requirePermission('finance.manage'), depositShift);
router.post('/cashier-shifts/:id/verify', requirePermission('stock.adjust'), verifyShift);

export default router;
