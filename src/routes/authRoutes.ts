import { Router } from 'express';

import { tcLoginController } from '@controllers/auth/lugocar/tcLoginController';
import { tcLogoutController } from '@controllers/auth/lugocar/tcLogoutController';
import { ugLoginController } from '@controllers/auth/ug/ugLoginController';
import { ugLogoutController } from '@controllers/auth/ug/ugLogoutController';
import { ctrlWrapper } from '@middleware/ctrlWrapper';

const router = Router();

router.get('/logout/ug', ctrlWrapper(ugLogoutController));
router.get('/logout/tc', ctrlWrapper(tcLogoutController));

router.post('/login/ug', ctrlWrapper(ugLoginController));
router.post('/login/tc', ctrlWrapper(tcLoginController));

export default router;
