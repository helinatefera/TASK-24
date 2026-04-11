import { Router } from 'express';
import * as ctrl from '../controllers/auth.controller';
import { validateRequest } from '../middleware/validateRequest';

const router = Router();
router.post('/register', validateRequest(ctrl.registerSchema), ctrl.register);
router.post('/login', validateRequest(ctrl.loginSchema), ctrl.login);
router.get('/me', ctrl.me);
router.post('/logout', ctrl.logout);
export default router;
