import { Router } from 'express';
import { requireAnyPermission, requireFeature } from '../../middlewares/auth.middleware';
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

router.get('/prescriptions/history', requireAnyPermission('prescription.manage', 'product.manage'), requireFeature('resep'), prescriptionHistory);
router.get('/prescriptions', requireAnyPermission('prescription.manage', 'product.manage'), requireFeature('resep'), listPrescriptions);
router.post('/prescriptions', requireAnyPermission('prescription.manage', 'product.manage'), requireFeature('resep'), createPrescription);
router.get('/prescriptions/:id', requireAnyPermission('prescription.manage', 'product.manage'), requireFeature('resep'), getPrescription);
router.patch('/prescriptions/:id', requireAnyPermission('prescription.manage', 'product.manage'), requireFeature('resep'), updatePrescription);
router.post('/prescriptions/:id/verify', requireAnyPermission('prescription.manage', 'product.manage'), requireFeature('resep'), verifyPrescription);
router.post('/prescriptions/:id/dispense', requireAnyPermission('prescription.manage', 'product.manage'), requireFeature('resep'), dispensePrescription);

export default router;
