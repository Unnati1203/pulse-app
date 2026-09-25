import { Router } from 'express';
import { scheduleEmails, getEmails, searchEmails, getEmailById } from '../controllers/emailController';
import { auth } from '../middleware/authMiddleware';

const router = Router();

router.use(auth);
router.post('/schedule', scheduleEmails);
router.get('/', getEmails);
router.get('/search', searchEmails);
router.get('/:id', getEmailById);

export default router;
