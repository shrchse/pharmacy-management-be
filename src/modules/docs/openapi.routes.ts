import { Router } from 'express';
import { docsIndex, getOpenApi } from './openapi.controller';

const router = Router();

router.get('/', docsIndex);
router.get('/openapi.json', getOpenApi);

export default router;
