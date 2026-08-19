import { Router } from 'express';
import { requireFeature, requirePermission } from '../../middlewares/auth.middleware';
import {
  createPrescription,
  dispensePrescription,
  getPrescription,
  listPrescriptions,
  prescriptionHistory,
  updatePrescription,
  verifyPrescription,
} from './pharmacy.controller';

const router = Router();

router.get('/prescriptions/history', requirePermission('product.manage'), requireFeature('resep'), prescriptionHistory);
router.get('/prescriptions', requirePermission('product.manage'), requireFeature('resep'), listPrescriptions);
router.post('/prescriptions', requirePermission('product.manage'), requireFeature('resep'), createPrescription);
router.get('/prescriptions/:id', requirePermission('product.manage'), requireFeature('resep'), getPrescription);
router.patch('/prescriptions/:id', requirePermission('product.manage'), requireFeature('resep'), updatePrescription);
router.post('/prescriptions/:id/verify', requirePermission('product.manage'), requireFeature('resep'), verifyPrescription);
router.post('/prescriptions/:id/dispense', requirePermission('product.manage'), requireFeature('resep'), dispensePrescription);

export default router;
