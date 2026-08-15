import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes';
import cashierShiftRoutes from '../modules/cashier-shifts/cashierShift.routes';
import complianceRoutes from '../modules/compliance/compliance.routes';
import docsRoutes from '../modules/docs/openapi.routes';
import financeRoutes from '../modules/finance/finance.routes';
import healthRoutes from '../modules/health/health.routes';
import inventoryRoutes from '../modules/inventory/inventory.routes';
import masterDataRoutes from '../modules/master-data/masterData.routes';
import posRoutes from '../modules/pos/pos.routes';
import productsRoutes from '../modules/products/products.routes';
import purchasesRoutes from '../modules/purchases/purchases.routes';
import starterRoutes from '../modules/starter/starter.routes';
import tenantRoutes from '../modules/tenant/tenant.routes';
import transactionsRoutes from '../modules/transactions/transactions.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/docs', docsRoutes);
router.use('/auth', authRoutes);
router.use('/', tenantRoutes);
router.use('/', masterDataRoutes);
router.use('/', productsRoutes);
router.use('/', inventoryRoutes);
router.use('/', cashierShiftRoutes);
router.use('/', posRoutes);
router.use('/', transactionsRoutes);
router.use('/', purchasesRoutes);
router.use('/', financeRoutes);
router.use('/', complianceRoutes);
router.use('/', starterRoutes);

export default router;
