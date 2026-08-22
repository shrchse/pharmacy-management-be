import { Router } from 'express';
import { requireFeature, requirePermission } from '../../middlewares/auth.middleware';
import {
  createProduct,
  deleteProduct,
  getProduct,
  listProductBatches,
  listProducts,
  searchProducts,
  updateProduct,
} from './products.controller';

const router = Router();

router.get('/products/search', requirePermission('stock.read'), requireFeature('inventory'), searchProducts);
router.get('/products', requirePermission('stock.read'), requireFeature('inventory'), listProducts);
router.post('/products', requirePermission('product.manage'), requireFeature('inventory'), createProduct);
router.get('/products/:id', requirePermission('stock.read'), requireFeature('inventory'), getProduct);
router.patch('/products/:id', requirePermission('product.manage'), requireFeature('inventory'), updateProduct);
router.delete('/products/:id', requirePermission('product.manage'), requireFeature('inventory'), deleteProduct);
router.get('/products/:id/batches', requirePermission('stock.read'), requireFeature('inventory'), listProductBatches);

export default router;
