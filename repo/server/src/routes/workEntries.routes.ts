import { Router } from 'express';
import * as ctrl from '../controllers/workEntry.controller';
import { validateRequest } from '../middleware/validateRequest';
import { authorize } from '../middleware/authorize';
import { Role } from '../types/enums';

const router = Router();
router.post('/:jobId/work-entries', authorize(Role.PHOTOGRAPHER, Role.ADMIN), validateRequest(ctrl.jobIdParamSchema, 'params'), validateRequest(ctrl.createWorkEntrySchema), ctrl.create);
router.get('/:jobId/work-entries', authorize(Role.ALUMNI, Role.PHOTOGRAPHER, Role.ADMIN), validateRequest(ctrl.jobIdParamSchema, 'params'), ctrl.getByJob);
export default router;
