import { Router } from 'express';
import { requireFeature, requirePermission } from '../../middlewares/auth.middleware';
import { createSalesReturn, listSalesReturns } from './returns.controller';

const router = Router();
router.get('/sales-returns', requirePermission('sale.return'), requireFeature('inventory'), listSalesReturns);
router.post('/sales-returns', requirePermission('sale.return'), requireFeature('inventory'), createSalesReturn);
export default router;
