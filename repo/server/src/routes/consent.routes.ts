import { Router } from 'express';
import * as ctrl from '../controllers/consent.controller';
import { validateRequest } from '../middleware/validateRequest';

const router = Router();
router.post('/', validateRequest(ctrl.recordConsentSchema), ctrl.recordConsent);
router.get('/history', ctrl.getConsentHistory);
router.get('/current-policy', ctrl.checkConsentCurrent);
router.get('/policy-history', ctrl.getPolicyHistory);
router.post('/data-category', validateRequest(ctrl.dataCategoryConsentSchema), ctrl.recordDataCategoryConsent);
router.delete('/data-category/:category', validateRequest(ctrl.deleteCategoryParamSchema, 'params'), ctrl.revokeDataCategoryConsent);
router.get('/data-category', ctrl.getCategoryConsents);
router.get('/data-categories', ctrl.getDataCategories);
export default router;
