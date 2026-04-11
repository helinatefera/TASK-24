import { Router } from 'express';
import * as ctrl from '../controllers/contentReview.controller';
import { authorize } from '../middleware/authorize';
import { validateRequest } from '../middleware/validateRequest';
import { Role } from '../types/enums';

const router = Router();
router.get('/content-reviews', authorize(Role.ADMIN), ctrl.getPending);
router.patch('/content-reviews/:id', authorize(Role.ADMIN), validateRequest(ctrl.contentReviewIdParamSchema, 'params'), validateRequest(ctrl.reviewContentSchema), ctrl.reviewContent);
export default router;
