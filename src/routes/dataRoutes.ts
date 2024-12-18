import { addToCartController } from 'controllers/data/addToCartController';
// import { autocompleteController } from 'controllers/data/autocompleteController';
import { Router } from 'express';
import { ctrlWrapper } from 'middleware/ctrlWrapper';
import { autocompleteUgController } from '../controllers/data/autocompleteUgController';

const router = Router();

router.get('/autocomplete/ug', ctrlWrapper(autocompleteUgController));
router.post('/addToCart', ctrlWrapper(addToCartController));

export default router;
