import { Router } from 'express';
import { getQueueStats } from '../controllers/queueController';

const router = Router();

router.get('/', getQueueStats);

export default router;
