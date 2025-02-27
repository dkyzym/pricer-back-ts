import { Router } from 'express';
import { ctrlWrapper } from 'middleware/ctrlWrapper.js';
import { webhookController } from '../controllers/webhooks/webhookController.js';

const router = Router();

router.post('/webhook', ctrlWrapper(webhookController));

export default router;
