import { Router } from 'express';
import { requireFeature, requirePermission } from '../../middlewares/auth.middleware';
import { createCampaign, createMember, listCampaigns, listMembers } from './crm.controller';

const router = Router();

router.get('/crm/members', requirePermission('product.manage'), requireFeature('crm'), listMembers);
router.post('/crm/members', requirePermission('product.manage'), requireFeature('crm'), createMember);
router.get('/crm/campaigns', requirePermission('product.manage'), requireFeature('crm'), listCampaigns);
router.post('/crm/campaigns', requirePermission('product.manage'), requireFeature('crm'), createCampaign);

export default router;
