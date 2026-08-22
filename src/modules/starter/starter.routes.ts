import { Router } from 'express';
import {
  starterIndex,
} from './starter.controller';

const router = Router();

router.get('/starter', starterIndex);

export default router;
