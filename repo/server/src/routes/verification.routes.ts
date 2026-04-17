import { Router } from 'express';
import multer from 'multer';
import * as ctrl from '../controllers/verification.controller';
import { authorize } from '../middleware/authorize';
import { validateRequest } from '../middleware/validateRequest';
import { Role } from '../types/enums';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const router = Router();
router.post('/submit', authorize(Role.PHOTOGRAPHER), upload.fields([
  { name: 'idDocument', maxCount: 1 },
  { name: 'qualificationDocs', maxCount: 5 },
  { name: 'taxForm', maxCount: 1 },
  { name: 'documents', maxCount: 10 },
]), ctrl.submit);
router.get('/status', ctrl.getStatus);
router.get('/requests', authorize(Role.ADMIN), ctrl.getRequests);
router.patch('/:id/review', authorize(Role.ADMIN), validateRequest(ctrl.verificationIdParamSchema, 'params'), validateRequest(ctrl.adminReviewSchema), ctrl.adminReview);
export default router;
