import { Router } from 'express';
import { requireFeature, requirePermission } from '../../middlewares/auth.middleware';
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

router.post('/purchase-orders/apj-pin', requirePermission('purchase.manage'), requireFeature('purchasing'), setApjPin);
router.get('/purchase-orders', requirePermission('purchase.manage'), requireFeature('purchasing'), listPurchaseOrders);
router.post('/purchase-orders', requirePermission('purchase.manage'), requireFeature('purchasing'), createPurchaseOrder);
router.get('/purchase-orders/:id', requirePermission('purchase.manage'), requireFeature('purchasing'), getPurchaseOrder);
router.post('/purchase-orders/:id/submit-approval', requirePermission('purchase.manage'), requireFeature('purchasing'), submitApproval);
router.post('/purchase-orders/:id/approve-apj', requirePermission('purchase.manage'), requireFeature('purchasing'), approveApj);
router.post('/purchase-orders/:id/receive', requirePermission('purchase.manage'), requireFeature('purchasing'), receivePurchaseOrder);

router.get('/invoices', requirePermission('purchase.manage'), requireFeature('purchasing'), listInvoices);
router.get('/purchase-returns', requirePermission('purchase.manage'), requireFeature('purchasing'), listPurchaseReturns);
router.post('/purchase-returns', requirePermission('purchase.manage'), requireFeature('purchasing'), createPurchaseReturn);

export default router;
