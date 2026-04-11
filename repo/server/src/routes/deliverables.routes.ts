import { Router } from 'express';
import multer from 'multer';
import * as ctrl from '../controllers/deliverable.controller';
import { validateRequest } from '../middleware/validateRequest';
import { authorize } from '../middleware/authorize';
import { Role } from '../types/enums';
import { ALLOWED_MIME_TYPES } from '../utils/constants';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`));
    }
  },
});
const router = Router();
router.post('/:jobId/deliverables', authorize(Role.PHOTOGRAPHER, Role.ADMIN), validateRequest(ctrl.jobIdParamSchema, 'params'), upload.single('file'), validateRequest(ctrl.uploadBodySchema), ctrl.upload);
router.get('/:jobId/deliverables', validateRequest(ctrl.jobIdParamSchema, 'params'), ctrl.getByJob);
export default router;
