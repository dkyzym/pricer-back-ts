import { autocompleteController } from 'controllers/data/autocompleteController';
import { getItemsListByArticleController } from 'controllers/data/getItemsListByArticleController';
import { Router } from 'express';
import { ctrlWrapper } from 'middleware/ctrlWrapper';

const router = Router();

router.get('/autocomplete/ug', ctrlWrapper(autocompleteController));
router.get(
  '/getItemsListByArticle',
  ctrlWrapper(getItemsListByArticleController)
);

export default router;
