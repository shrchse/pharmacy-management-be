import { Router } from 'express';
import { requireAuth, requireFeature, requirePermission, requireSuperadmin } from '../../middlewares/auth.middleware';
import {
  activateTenantProduct,
  createCatalog,
  deactivateCatalog,
  deactivateTenantProduct,
  listCatalog,
  listTenantProducts,
  updateCatalog,
  updateTenantProduct,
} from './productCatalog.controller';

const router = Router();

router.get('/product-catalog', requireAuth, listCatalog);
router.post('/product-catalog', requireSuperadmin, createCatalog);
router.patch('/product-catalog/:id', requireSuperadmin, updateCatalog);
router.delete('/product-catalog/:id', requireSuperadmin, deactivateCatalog);
router.get('/tenant-products', requirePermission('stock.read'), requireFeature('inventory'), listTenantProducts);
router.post('/tenant-products', requirePermission('product.manage'), requireFeature('inventory'), activateTenantProduct);
router.patch('/tenant-products/:id', requirePermission('product.manage'), requireFeature('inventory'), updateTenantProduct);
router.delete('/tenant-products/:id', requirePermission('product.manage'), requireFeature('inventory'), deactivateTenantProduct);

export default router;
