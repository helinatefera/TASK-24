import { Router } from 'express';
import { z } from 'zod';
import * as ctrl from '../controllers/file.controller';
import { validateRequest } from '../middleware/validateRequest';
import { authorize } from '../middleware/authorize';
import { Role } from '../types/enums';

const fileIdParamSchema = z.object({
  id: z.string().min(1),
});

const router = Router();
router.get('/:id', authorize(Role.ALUMNI, Role.PHOTOGRAPHER, Role.ADMIN), validateRequest(fileIdParamSchema, 'params'), ctrl.getFile);
export default router;
