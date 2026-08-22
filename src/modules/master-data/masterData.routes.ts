import { Router } from 'express';
import { requireAnyPermission, requireFeature, requirePermission } from '../../middlewares/auth.middleware';
import {
  createBranch,
  updateBranch,
  deleteBranch,
  createCategory,
  deleteCategory,
  createCustomer,
  createDoctor,
  createRack,
  updateRack,
  deleteRack,
  createSupplier,
  createUnit,
  deleteUnit,
  createUser,
  deactivateUser,
  listBranches,
  listCategories,
  listCustomers,
  listDoctors,
  listRacks,
  listSuppliers,
  listUnits,
  listUsers,
  updateSupplier,
  deleteSupplier,
  updateCustomer,
  deleteCustomer,
  updateDoctor,
  deleteDoctor,
  updateUser,
  updateCategory,
  updateUnit,
} from './masterData.controller';

const router = Router();

router.get('/branches', requirePermission('branch.manage'), listBranches);
router.post('/branches', requirePermission('branch.manage'), createBranch);
router.patch('/branches/:id', requirePermission('branch.manage'), updateBranch);
router.delete('/branches/:id', requirePermission('branch.manage'), deleteBranch);
router.get('/outlets', requirePermission('branch.manage'), listBranches);
router.post('/outlets', requirePermission('branch.manage'), createBranch);
router.patch('/outlets/:id', requirePermission('branch.manage'), updateBranch);
router.delete('/outlets/:id', requirePermission('branch.manage'), deleteBranch);

router.get('/categories', requirePermission('product.manage'), requireFeature('inventory'), listCategories);
router.post('/categories', requirePermission('product.manage'), requireFeature('inventory'), createCategory);
router.patch('/categories/:id', requirePermission('product.manage'), requireFeature('inventory'), updateCategory);
router.delete('/categories/:id', requirePermission('product.manage'), requireFeature('inventory'), deleteCategory);

router.get('/units', requirePermission('product.manage'), requireFeature('inventory'), listUnits);
router.post('/units', requirePermission('product.manage'), requireFeature('inventory'), createUnit);
router.patch('/units/:id', requirePermission('product.manage'), requireFeature('inventory'), updateUnit);
router.delete('/units/:id', requirePermission('product.manage'), requireFeature('inventory'), deleteUnit);

router.get('/racks', requirePermission('stock.read'), requireFeature('inventory'), listRacks);
router.post('/racks', requirePermission('stock.adjust'), requireFeature('inventory'), createRack);
router.patch('/racks/:id', requirePermission('stock.adjust'), requireFeature('inventory'), updateRack);
router.delete('/racks/:id', requirePermission('stock.adjust'), requireFeature('inventory'), deleteRack);

router.get('/suppliers', requirePermission('purchase.manage'), requireFeature('purchasing'), listSuppliers);
router.post('/suppliers', requirePermission('purchase.manage'), requireFeature('purchasing'), createSupplier);
router.patch('/suppliers/:id', requirePermission('purchase.manage'), requireFeature('purchasing'), updateSupplier);
router.delete('/suppliers/:id', requirePermission('purchase.manage'), requireFeature('purchasing'), deleteSupplier);

router.get('/customers', requirePermission('product.manage'), listCustomers);
router.post('/customers', requirePermission('product.manage'), createCustomer);
router.patch('/customers/:id', requirePermission('product.manage'), updateCustomer);
router.delete('/customers/:id', requirePermission('product.manage'), deleteCustomer);

router.get('/doctors', requireAnyPermission('product.manage', 'prescription.manage'), requireFeature('resep'), listDoctors);
router.post('/doctors', requireAnyPermission('product.manage', 'prescription.manage'), requireFeature('resep'), createDoctor);
router.patch('/doctors/:id', requireAnyPermission('product.manage', 'prescription.manage'), requireFeature('resep'), updateDoctor);
router.delete('/doctors/:id', requireAnyPermission('product.manage', 'prescription.manage'), requireFeature('resep'), deleteDoctor);

router.get('/users', requirePermission('user.manage'), listUsers);
router.post('/users', requirePermission('user.manage'), createUser);
router.patch('/users/:id', requirePermission('user.manage'), updateUser);
router.delete('/users/:id', requirePermission('user.manage'), deactivateUser);

export default router;
