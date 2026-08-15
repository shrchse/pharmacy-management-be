import { Router } from 'express';
import { bootstrap, createDevToken, login, logout, me, refresh } from './auth.controller';
import { requireAuth } from '../../middlewares/auth.middleware';

const router = Router();

router.post('/bootstrap', bootstrap);
router.post('/login', login);
router.post('/logout', requireAuth, logout);
router.post('/refresh', requireAuth, refresh);
router.get('/me', requireAuth, me);
router.post('/dev-token', createDevToken);

export default router;
