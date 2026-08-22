import { Router } from 'express';
import { bootstrap, createDevToken, login, logout, me, refresh } from './auth.controller';
import { createSupervisorAuthorization } from './supervisor.controller';
import { optionalAuth, requireAuth } from '../../middlewares/auth.middleware';

const router = Router();

router.post('/bootstrap', bootstrap);
router.post('/login', login);
router.post('/logout', requireAuth, logout);
router.post('/refresh', optionalAuth, refresh);
router.get('/me', requireAuth, me);
router.post('/supervisor-authorizations', requireAuth, createSupervisorAuthorization);
router.post('/dev-token', createDevToken);

export default router;
