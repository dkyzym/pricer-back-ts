import { addToCartController } from 'controllers/data/addToCartController';
import { autocompleteController } from 'controllers/data/autocompleteController';
import { Router } from 'express';
import { ctrlWrapper } from 'middleware/ctrlWrapper';

const router = Router();

router.get('/autocomplete/ug', ctrlWrapper(autocompleteController));
router.post('/addToCart', ctrlWrapper(addToCartController));

export default router;
