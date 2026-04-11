import { Router } from 'express';
import * as ctrl from '../controllers/profile.controller';
import { validateRequest } from '../middleware/validateRequest';
import { authorize } from '../middleware/authorize';
import { Role } from '../types/enums';

const router = Router();
router.get('/me', authorize(Role.ALUMNI, Role.PHOTOGRAPHER, Role.ADMIN), ctrl.getMyProfile);
router.put('/me', authorize(Role.ALUMNI, Role.PHOTOGRAPHER, Role.ADMIN), validateRequest(ctrl.updateProfileSchema), ctrl.updateMyProfile);
router.get('/:id', authorize(Role.ALUMNI, Role.PHOTOGRAPHER, Role.ADMIN), validateRequest(ctrl.profileIdParamSchema, 'params'), ctrl.getProfile);
router.get('/', authorize(Role.ALUMNI, Role.PHOTOGRAPHER, Role.ADMIN), validateRequest(ctrl.getProfilesQuerySchema, 'query'), ctrl.getProfiles);
export default router;
