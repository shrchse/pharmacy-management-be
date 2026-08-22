import { Router } from 'express';
import { requireFeature, requirePermission } from '../../middlewares/auth.middleware';
import { cancelTransaction, getReceipt, getTransaction, listTransactions } from './transactions.controller';

const router = Router();

router.get('/transactions', requirePermission('pos.checkout'), requireFeature('inventory'), listTransactions);
router.get('/transactions/:id', requirePermission('pos.checkout'), requireFeature('inventory'), getTransaction);
router.post('/transactions/:id/cancel', requirePermission('sale.return'), requireFeature('inventory'), cancelTransaction);
router.get('/receipts/:transactionId', requirePermission('pos.checkout'), requireFeature('inventory'), getReceipt);

export default router;
