import { Router } from 'express';
import { requireAuth, requireSuperadmin } from '../../middlewares/auth.middleware';
import {
  activeTenant,
  createInternalTenant,
  createPlan,
  getInternalTenant,
  listInternalTenants,
  listPlans,
  resetDemoTenant,
  resetTenantUserPassword,
  switchActiveTenant,
  updateInternalTenant,
  updateTenantEntitlement,
  updateTenantSubscription,
} from './tenant.controller';

const router = Router();

router.get('/tenants/active', requireAuth, activeTenant);
router.post('/tenants/active', requireAuth, switchActiveTenant);
router.get('/internal/plans', requireSuperadmin, listPlans);
router.post('/internal/plans', requireSuperadmin, createPlan);
router.get('/internal/tenants', requireSuperadmin, listInternalTenants);
router.post('/internal/tenants', requireSuperadmin, createInternalTenant);
router.get('/internal/tenants/:id', requireSuperadmin, getInternalTenant);
router.patch('/internal/tenants/:id', requireSuperadmin, updateInternalTenant);
router.patch('/internal/tenants/:id/entitlement', requireSuperadmin, updateTenantEntitlement);
router.patch('/internal/tenants/:id/subscription', requireSuperadmin, updateTenantSubscription);
router.patch('/internal/tenants/:tenantId/users/:userId/password', requireSuperadmin, resetTenantUserPassword);
router.post('/internal/tenants/:id/reset-demo', requireSuperadmin, resetDemoTenant);

export default router;
