import { Router } from 'express';
import * as ctrl from '../controllers/workEntry.controller';
import { validateRequest } from '../middleware/validateRequest';
import { authorize } from '../middleware/authorize';
import { Role } from '../types/enums';

const router = Router();
router.put('/:id', authorize(Role.PHOTOGRAPHER, Role.ADMIN), validateRequest(ctrl.workEntryIdParamSchema, 'params'), validateRequest(ctrl.updateWorkEntrySchema), ctrl.update);
router.patch('/:id/confirm', authorize(Role.ALUMNI, Role.PHOTOGRAPHER, Role.ADMIN), validateRequest(ctrl.workEntryIdParamSchema, 'params'), ctrl.confirm);
export default router;
