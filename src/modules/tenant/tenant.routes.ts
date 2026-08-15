import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middlewares/auth.middleware';
import { activeTenant, createInternalTenant, listInternalTenants } from './tenant.controller';

const router = Router();

router.get('/tenants/active', requireAuth, activeTenant);
router.get('/internal/tenants', requirePermission('internal.tenant.manage'), listInternalTenants);
router.post('/internal/tenants', requirePermission('internal.tenant.manage'), createInternalTenant);

export default router;
