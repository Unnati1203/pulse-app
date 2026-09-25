import { Router } from 'express';
import authRoutes from './authRoutes';
import emailRoutes from './emailRoutes';
import dashboardRoutes from './dashboardRoutes';
import slackRoutes from './slackRoutes';
import queueRoutes from './queueRoutes';
import { ok } from '../utils/response';

const router = Router();

router.get('/health', (_req, res) => ok(res, { status: 'ok' }));
router.use('/auth', authRoutes);
router.use('/emails', emailRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/slack', slackRoutes);
router.use('/queue', queueRoutes);

export default router;
