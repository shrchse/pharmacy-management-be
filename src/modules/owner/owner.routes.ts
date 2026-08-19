import { Router } from 'express';
import { requireAnyPermission, requirePermission } from '../../middlewares/auth.middleware';
import {
  auditControl,
  dailyBrief,
  dashboard,
  healthScore,
  inventoryAnalysis,
  paretoAnalysis,
  productMarginAnalysis,
  recommendations,
  supplierPurchasesAnalysis,
  warnings,
} from './owner.controller';

const router = Router();

router.get('/owner/dashboard', requirePermission('report.read'), dashboard);
router.get('/owner/daily-brief', requirePermission('report.read'), dailyBrief);
router.get('/owner/health-score', requirePermission('report.read'), healthScore);
router.get('/owner/warnings', requirePermission('report.read'), warnings);
router.get('/owner/recommendations', requirePermission('report.read'), recommendations);
router.get('/owner/audit-control', requireAnyPermission('audit.read', 'report.read'), auditControl);
router.get('/analysis/inventory', requirePermission('report.read'), inventoryAnalysis);
router.get('/analysis/pareto', requirePermission('report.read'), paretoAnalysis);
router.get('/analysis/product-margin', requirePermission('report.read'), productMarginAnalysis);
router.get('/analysis/supplier-purchases', requirePermission('report.read'), supplierPurchasesAnalysis);

export default router;
