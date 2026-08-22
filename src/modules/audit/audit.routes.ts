import { Router } from 'express';
import { requirePermission } from '../../middlewares/auth.middleware';
import { listAuditLogs } from './audit.controller';

const router = Router();
router.get('/audit-logs', requirePermission('audit.read'), listAuditLogs);
export default router;
