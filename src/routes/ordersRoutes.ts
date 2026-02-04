import { Router } from 'express';
import { ctrlWrapper } from 'middleware/ctrlWrapper.js';
import { getOrders } from '../controllers/data/orders/ordersController.js';

const router = Router();

router.get('/orders', ctrlWrapper(getOrders));

export default router;
