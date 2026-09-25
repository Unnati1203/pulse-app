import { Router } from 'express';
import { getSlackStatus, connectSlack, slackCallback, disconnectSlack } from '../controllers/slackController';
import { auth } from '../middleware/authMiddleware';

const router = Router();

router.get('/status', auth, getSlackStatus);
router.get('/connect', auth, connectSlack);
router.get('/callback', slackCallback);
router.delete('/disconnect', auth, disconnectSlack);

export default router;
