import { Router } from 'express';
import { googleAuth, googleCallback, getMe, logout } from '../controllers/authController';

const router = Router();

router.get('/google', googleAuth);
router.get('/google/callback', googleCallback);
router.get('/me', getMe);
router.post('/logout', logout);

export default router;
