import { Router } from 'express';
import { requirePermission } from '../../middlewares/auth.middleware';
import { cancelTransaction, getReceipt, getTransaction, listTransactions } from './transactions.controller';

const router = Router();

router.get('/transactions', requirePermission('pos.checkout'), listTransactions);
router.get('/transactions/:id', requirePermission('pos.checkout'), getTransaction);
router.post('/transactions/:id/cancel', requirePermission('sale.return'), cancelTransaction);
router.get('/receipts/:transactionId', requirePermission('pos.checkout'), getReceipt);

export default router;
