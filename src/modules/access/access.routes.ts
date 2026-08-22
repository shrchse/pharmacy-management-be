import { Router } from 'express';
import { requirePermission } from '../../middlewares/auth.middleware';
import { createRole, deleteRole, listPermissions, listRoles, updateRole } from './access.controller';

const router = Router();
router.get('/permissions', requirePermission('role.manage'), listPermissions);
router.get('/roles', requirePermission('role.manage'), listRoles);
router.post('/roles', requirePermission('role.manage'), createRole);
router.patch('/roles/:id', requirePermission('role.manage'), updateRole);
router.delete('/roles/:id', requirePermission('role.manage'), deleteRole);
export default router;
