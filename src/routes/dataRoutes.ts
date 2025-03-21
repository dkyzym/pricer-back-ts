import { addToCartController } from 'controllers/data/addToCartController.js';
import { Router } from 'express';
import { ctrlWrapper } from 'middleware/ctrlWrapper.js';
import { autocompleteUgController } from '../controllers/data/autocompleteUgController.js';

const router = Router();

router.get('/autocomplete/ug', ctrlWrapper(autocompleteUgController));
router.post('/cart/add', ctrlWrapper(addToCartController));

export default router;
