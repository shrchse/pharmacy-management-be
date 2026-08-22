import { Router } from 'express';
import { requireFeature, requirePermission } from '../../middlewares/auth.middleware';
import { checkout } from './pos.controller';

const router = Router();

router.post('/pos/checkout', requirePermission('pos.checkout'), requireFeature('inventory'), checkout);

export default router;
