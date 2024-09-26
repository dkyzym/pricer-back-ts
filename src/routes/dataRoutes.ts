import { autocompleteController } from 'controllers/data/autocompleteController';
import { Router } from 'express';
import { ctrlWrapper } from 'middleware/ctrlWrapper';

const router = Router();

router.get('/autocomplete/ug', ctrlWrapper(autocompleteController));

export default router;
