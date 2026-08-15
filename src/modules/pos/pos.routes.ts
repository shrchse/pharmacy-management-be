import { Router } from 'express';
import { requirePermission } from '../../middlewares/auth.middleware';
import { checkout } from './pos.controller';

const router = Router();

router.post('/pos/checkout', requirePermission('pos.checkout'), checkout);

export default router;
