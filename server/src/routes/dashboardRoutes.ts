import { Router } from 'express';
import { getDashboardStats } from '../controllers/dashboardController';
import { auth } from '../middleware/authMiddleware';

const router = Router();

router.use(auth);
router.get('/', getDashboardStats);

export default router;
