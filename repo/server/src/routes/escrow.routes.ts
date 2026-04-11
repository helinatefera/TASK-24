import { Router } from 'express';
import * as ctrl from '../controllers/escrow.controller';
import { validateRequest } from '../middleware/validateRequest';
import { authorize } from '../middleware/authorize';
import { Role } from '../types/enums';

const router = Router();
router.post('/:jobId/escrow', authorize(Role.ALUMNI, Role.PHOTOGRAPHER, Role.ADMIN), validateRequest(ctrl.jobIdParamSchema, 'params'), validateRequest(ctrl.addEscrowEntrySchema), ctrl.addEntry);
router.get('/:jobId/escrow', authorize(Role.ALUMNI, Role.PHOTOGRAPHER, Role.ADMIN), validateRequest(ctrl.jobIdParamSchema, 'params'), ctrl.getByJob);
export default router;
