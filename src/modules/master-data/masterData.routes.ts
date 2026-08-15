import { Router } from 'express';
import { requirePermission } from '../../middlewares/auth.middleware';
import {
  createBranch,
  createCategory,
  createCustomer,
  createDoctor,
  createRack,
  createSupplier,
  createUnit,
  createUser,
  listBranches,
  listCategories,
  listCustomers,
  listDoctors,
  listRacks,
  listSuppliers,
  listUnits,
  listUsers,
} from './masterData.controller';

const router = Router();

router.get('/branches', requirePermission('branch.manage'), listBranches);
router.post('/branches', requirePermission('branch.manage'), createBranch);
router.get('/outlets', requirePermission('branch.manage'), listBranches);
router.post('/outlets', requirePermission('branch.manage'), createBranch);

router.get('/categories', requirePermission('product.manage'), listCategories);
router.post('/categories', requirePermission('product.manage'), createCategory);

router.get('/units', requirePermission('product.manage'), listUnits);
router.post('/units', requirePermission('product.manage'), createUnit);

router.get('/racks', requirePermission('stock.read'), listRacks);
router.post('/racks', requirePermission('stock.adjust'), createRack);

router.get('/suppliers', requirePermission('purchase.manage'), listSuppliers);
router.post('/suppliers', requirePermission('purchase.manage'), createSupplier);

router.get('/customers', requirePermission('product.manage'), listCustomers);
router.post('/customers', requirePermission('product.manage'), createCustomer);

router.get('/doctors', requirePermission('product.manage'), listDoctors);
router.post('/doctors', requirePermission('product.manage'), createDoctor);

router.get('/users', requirePermission('user.manage'), listUsers);
router.post('/users', requirePermission('user.manage'), createUser);

export default router;
