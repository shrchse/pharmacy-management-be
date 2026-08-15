import { Router } from 'express';
import { optionalAuth } from '../../middlewares/auth.middleware';
import {
  checkout,
  createBatch,
  createBranch,
  createCategory,
  createProduct,
  createTenant,
  createUnit,
  listBranches,
  listProducts,
  listTenants,
  starterIndex,
  stockOverview,
} from './starter.controller';

const router = Router();

router.use(optionalAuth);

router.get('/starter', starterIndex);

router.get('/tenants', listTenants);
router.post('/tenants', createTenant);
router.get('/tenants/:tenantId/branches', listBranches);
router.post('/tenants/:tenantId/branches', createBranch);
router.post('/tenants/:tenantId/categories', createCategory);
router.get('/tenants/:tenantId/products', listProducts);

router.get('/branches', listBranches);
router.post('/units', createUnit);
router.get('/products', listProducts);
router.post('/products', createProduct);

router.post('/branches/:branchId/stock/batches', createBatch);
router.get('/branches/:branchId/stock/overview', stockOverview);
router.post('/branches/:branchId/pos/checkout', checkout);

export default router;
