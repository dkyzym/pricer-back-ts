import { Router } from 'express';
import { ctrlWrapper } from 'middleware/ctrlWrapper.js';
import { ordersController } from '../controllers/orders/ordersController.js';

const router = Router();

router.get('/orders', ctrlWrapper(ordersController));

export default router;
