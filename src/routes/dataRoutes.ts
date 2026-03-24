import { actualizeCartController } from '@controllers/cart/actualizeCartController.js';
import { addToCartController } from '@controllers/cart/addToCartController.js';
import { checkoutCartController } from '@controllers/cart/checkoutCartController.js';
import { deleteCartItemController } from '@controllers/cart/deleteCartItemController.js';
import { getCartController } from '@controllers/cart/getCartController.js';
import { updateCartItemQuantityController } from '@controllers/cart/updateCartItemQuantityController.js';
import { updateCartItemStatusController } from '@controllers/cart/updateCartItemStatusController.js';
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
router.delete(
  '/cart/:id',
  authMiddleware,
  ctrlWrapper(deleteCartItemController)
);
router.patch(
  '/cart/:id/quantity',
  authMiddleware,
  ctrlWrapper(updateCartItemQuantityController)
);
router.patch(
  '/cart/:id/status',
  authMiddleware,
  ctrlWrapper(updateCartItemStatusController)
);
router.post(
  '/cart/actualize',
  authMiddleware,
  ctrlWrapper(actualizeCartController)
);
router.post(
  '/cart/checkout',
  authMiddleware,
  ctrlWrapper(checkoutCartController)
);

export default router;
