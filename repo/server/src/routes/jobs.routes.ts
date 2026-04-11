import { Router } from 'express';
import * as ctrl from '../controllers/job.controller';
import { contentFilterMiddleware } from '../middleware/contentFilter';
import { validateRequest } from '../middleware/validateRequest';
import { authorize } from '../middleware/authorize';
import { Role } from '../types/enums';

const router = Router();
router.post('/', authorize(Role.ALUMNI, Role.ADMIN), validateRequest(ctrl.createJobSchema), contentFilterMiddleware(['description']), ctrl.create);
router.get('/', authorize(Role.ALUMNI, Role.PHOTOGRAPHER, Role.ADMIN), validateRequest(ctrl.jobQuerySchema, 'query'), ctrl.getAll);
router.get('/:id', authorize(Role.ALUMNI, Role.PHOTOGRAPHER, Role.ADMIN), validateRequest(ctrl.jobIdParamSchema, 'params'), ctrl.getById);
router.put('/:id', authorize(Role.ALUMNI, Role.ADMIN), validateRequest(ctrl.updateJobSchema), contentFilterMiddleware(['description']), ctrl.update);
router.patch('/:id/assign', authorize(Role.ALUMNI, Role.ADMIN), validateRequest(ctrl.assignJobSchema), ctrl.assign);
router.post('/:id/agreement/confirm', authorize(Role.ALUMNI, Role.PHOTOGRAPHER, Role.ADMIN), ctrl.confirmAgreement);
export default router;
