import { addToCartController } from '@controllers/data/cart/addToCartController.js';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { ctrlWrapper } from 'middleware/ctrlWrapper.js';
import { autocompleteUgController } from '../controllers/data/autocompleteUgController.js';

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
router.post('/cart/add', ctrlWrapper(addToCartController));

export default router;
