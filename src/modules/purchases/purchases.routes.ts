import { Router } from 'express';
import { requirePermission } from '../../middlewares/auth.middleware';
import {
  approveApj,
  createPurchaseOrder,
  createPurchaseReturn,
  getPurchaseOrder,
  listInvoices,
  listPurchaseOrders,
  listPurchaseReturns,
  receivePurchaseOrder,
  setApjPin,
  submitApproval,
} from './purchases.controller';

const router = Router();

router.post('/purchase-orders/apj-pin', requirePermission('purchase.manage'), setApjPin);
router.get('/purchase-orders', requirePermission('purchase.manage'), listPurchaseOrders);
router.post('/purchase-orders', requirePermission('purchase.manage'), createPurchaseOrder);
router.get('/purchase-orders/:id', requirePermission('purchase.manage'), getPurchaseOrder);
router.post('/purchase-orders/:id/submit-approval', requirePermission('purchase.manage'), submitApproval);
router.post('/purchase-orders/:id/approve-apj', requirePermission('purchase.manage'), approveApj);
router.post('/purchase-orders/:id/receive', requirePermission('purchase.manage'), receivePurchaseOrder);

router.get('/invoices', requirePermission('purchase.manage'), listInvoices);
router.get('/purchase-returns', requirePermission('purchase.manage'), listPurchaseReturns);
router.post('/purchase-returns', requirePermission('purchase.manage'), createPurchaseReturn);

export default router;
