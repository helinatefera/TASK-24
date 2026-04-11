import { Router } from 'express';
import * as ctrl from '../controllers/settlement.controller';
import { validateRequest } from '../middleware/validateRequest';
import { authorize } from '../middleware/authorize';
import { Role } from '../types/enums';

const router = Router();
router.post('/:jobId/settlement', authorize(Role.ALUMNI, Role.PHOTOGRAPHER, Role.ADMIN), validateRequest(ctrl.jobIdParamSchema, 'params'), ctrl.generate);
export default router;
