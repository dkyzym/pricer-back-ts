import { Router } from 'express';
// import { orionLoginController } from '../controllers/auth/orion/orionLoginController';
import { orionLoginController } from '@controllers/auth/orion/orionLoginController';
import { ctrlWrapper } from '@middleware/ctrlWrapper';

// import { loginTC, logoutTC } from '#controllers/auth/tcAuthController.js';
// import { loginUG, logoutUG } from '#controllers/auth/ugAuthController.js';
// import { loginPT, logoutPT } from '#controllers/auth/ptAuthController.js';
// import { loginOR, logoutOR } from '#controllers/auth/orAuthController.js';
// import { loginAR, logoutAR } from '#controllers/auth/arAuthController.js';

const router = Router();

// router.get('/logout/tc', ctrlWrapper(logoutTC));
// router.get('/logout/ug', ctrlWrapper(logoutUG));
// router.get('/logout/pt', ctrlWrapper(logoutPT));
// router.get('/logout/or', ctrlWrapper(logoutOR));
// router.get('/logout/ar', ctrlWrapper(logoutAR));

// router.post('/login/tc', ctrlWrapper(loginTC));
// router.post('/login/ug', ctrlWrapper(loginUG));
// router.post('/login/pt', ctrlWrapper(loginPT));
router.post('/login/or', ctrlWrapper(orionLoginController));
// router.post('/login/ar', ctrlWrapper(loginAR));

export default router;
