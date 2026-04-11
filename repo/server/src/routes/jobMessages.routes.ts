import { Router } from 'express';
import * as ctrl from '../controllers/jobMessage.controller';
import { contentFilterMiddleware } from '../middleware/contentFilter';
import { validateRequest } from '../middleware/validateRequest';
import { authorize } from '../middleware/authorize';
import { Role } from '../types/enums';

const router = Router();
router.post('/:jobId/messages', authorize(Role.ALUMNI, Role.PHOTOGRAPHER, Role.ADMIN), validateRequest(ctrl.sendMessageSchema), contentFilterMiddleware(['messageText', 'content']), ctrl.send);
router.get('/:jobId/messages', authorize(Role.ALUMNI, Role.PHOTOGRAPHER, Role.ADMIN), validateRequest(ctrl.listMessagesQuerySchema, 'query'), ctrl.list);
export default router;
