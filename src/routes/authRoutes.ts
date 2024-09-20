import { Router } from 'express';

import { tcLoginController } from '@controllers/auth/lugocar/tcLoginController';
import { tcLogoutController } from '@controllers/auth/lugocar/tcLogoutController';
import { patriotLoginController } from '@controllers/auth/patriot/patriotLoginController';
import { patriotLogoutController } from '@controllers/auth/patriot/patriotLogoutController';
import { ugLoginController } from '@controllers/auth/ug/ugLoginController';
import { ugLogoutController } from '@controllers/auth/ug/ugLogoutController';
import { ctrlWrapper } from '@middleware/ctrlWrapper';

const router = Router();

router.get('/logout/ug', ctrlWrapper(ugLogoutController));
router.get('/logout/tc', ctrlWrapper(tcLogoutController));
router.get('/logout/pt', ctrlWrapper(patriotLogoutController));
// router.get('/logout/or', ctrlWrapper(orionLogoutController));
// router.get('/logout/ar', ctrlWrapper(logoutAR));

router.post('/login/ug', ctrlWrapper(ugLoginController));
router.post('/login/pt', ctrlWrapper(patriotLoginController));
router.post('/login/tc', ctrlWrapper(tcLoginController));
// router.post('/login/ar', ctrlWrapper(loginAR));
// router.post('/login/or', ctrlWrapper(orionLoginController));

export default router;
