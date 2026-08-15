import { Router } from 'express';
import { requireAnyPermission } from '../../middlewares/auth.middleware';
import {
  createLicense,
  createPractitionerLicense,
  licenseAlerts,
  listLicenses,
  listPractitionerLicenses,
  updateLicense,
  updatePractitionerLicense,
} from './compliance.controller';

const router = Router();

router.get('/licenses', requireAnyPermission('compliance.manage', 'finance.manage'), listLicenses);
router.post('/licenses', requireAnyPermission('compliance.manage', 'finance.manage'), createLicense);
router.patch('/licenses/:id', requireAnyPermission('compliance.manage', 'finance.manage'), updateLicense);

router.get('/practitioner-licenses', requireAnyPermission('compliance.manage', 'finance.manage'), listPractitionerLicenses);
router.post('/practitioner-licenses', requireAnyPermission('compliance.manage', 'finance.manage'), createPractitionerLicense);
router.patch('/practitioner-licenses/:id', requireAnyPermission('compliance.manage', 'finance.manage'), updatePractitionerLicense);

router.get('/licenses/alerts', requireAnyPermission('compliance.manage', 'finance.manage'), licenseAlerts);

export default router;
