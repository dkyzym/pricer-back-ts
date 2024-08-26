import { Router } from 'express';

import { tcLoginController } from '@controllers/auth/lugocar/tcLoginController';
import { tcLogoutController } from '@controllers/auth/lugocar/tcLogoutController';
import { orionLoginController } from '@controllers/auth/orion/orionLoginController';
import { orionLogoutController } from '@controllers/auth/orion/orionLogoutController';
import { ugLoginController } from '@controllers/auth/ug/ugLoginController';
import { ugLogoutController } from '@controllers/auth/ug/ugLogoutController';
import { ctrlWrapper } from '@middleware/ctrlWrapper';

// import { loginTC, logoutTC } from '#controllers/auth/tcAuthController.js';
// import { loginUG, logoutUG } from '#controllers/auth/ugAuthController.js';
// import { loginPT, logoutPT } from '#controllers/auth/ptAuthController.js';
// import { loginOR, logoutOR } from '#controllers/auth/orAuthController.js';
// import { loginAR, logoutAR } from '#controllers/auth/arAuthController.js';

const router = Router();

router.get('/logout/ug', ctrlWrapper(ugLogoutController));
router.get('/logout/or', ctrlWrapper(orionLogoutController));
router.get('/logout/tc', ctrlWrapper(tcLogoutController));
// router.get('/logout/pt', ctrlWrapper(logoutPT));
// router.get('/logout/ar', ctrlWrapper(logoutAR));

router.post('/login/ug', ctrlWrapper(ugLoginController));
router.post('/login/or', ctrlWrapper(orionLoginController));
router.post('/login/tc', ctrlWrapper(tcLoginController));
// router.post('/login/pt', ctrlWrapper(loginPT));
// router.post('/login/ar', ctrlWrapper(loginAR));

export default router;
