import { Router } from 'express';
import * as ctrl from '../controllers/audit.controller';
import { authorize } from '../middleware/authorize';
import { Role } from '../types/enums';

const router = Router();
router.get('/audit', authorize(Role.ADMIN), ctrl.getAuditLogs);
export default router;
