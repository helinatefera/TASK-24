import { Router } from 'express';
import * as ctrl from '../controllers/privacy.controller';
import { validateRequest } from '../middleware/validateRequest';

const router = Router();
router.get('/settings', ctrl.getPrivacySettings);
router.put('/settings', validateRequest(ctrl.updatePrivacySettingsSchema), ctrl.updatePrivacySettings);
export default router;
