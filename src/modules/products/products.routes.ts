import { Router } from 'express';
import { requirePermission } from '../../middlewares/auth.middleware';
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

router.get('/products/search', requirePermission('stock.read'), searchProducts);
router.get('/products', requirePermission('stock.read'), listProducts);
router.post('/products', requirePermission('product.manage'), createProduct);
router.get('/products/:id', requirePermission('stock.read'), getProduct);
router.patch('/products/:id', requirePermission('product.manage'), updateProduct);
router.delete('/products/:id', requirePermission('product.manage'), deleteProduct);
router.get('/products/:id/batches', requirePermission('stock.read'), listProductBatches);

export default router;
