import { addToCartController } from '@controllers/cart/addToCartController.js';
import { getCartController } from '@controllers/cart/getCartController.js';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { ctrlWrapper } from 'middleware/ctrlWrapper.js';
import { autocompleteUgController } from '../controllers/autocomplete/autocompleteUgController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const autocompleteLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, try again later' },
});

const router = Router();

router.get(
  '/autocomplete/ug',
  authMiddleware,
  autocompleteLimiter,
  ctrlWrapper(autocompleteUgController)
);
router.post('/cart/add', authMiddleware, ctrlWrapper(addToCartController));
router.get('/cart', authMiddleware, ctrlWrapper(getCartController));

export default router;
