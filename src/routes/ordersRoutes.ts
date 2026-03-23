import { Router } from 'express';
import { ctrlWrapper } from 'middleware/ctrlWrapper.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { ordersController } from '../controllers/orders/ordersController.js';

const router = Router();

router.get('/orders', authMiddleware, ctrlWrapper(ordersController));

export default router;
