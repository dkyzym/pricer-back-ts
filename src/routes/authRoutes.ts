import { Router } from 'express';
import { ctrlWrapper } from 'middleware/ctrlWrapper.js';
import { authService } from '../services/auth/authService.js';

const router = Router();

router.post('/auth', ctrlWrapper(authService));

export default router;
