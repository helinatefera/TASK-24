import { Router } from 'express';
import multer from 'multer';
import * as ctrl from '../controllers/portfolio.controller';
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
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.get('/:id/images', ctrl.getImages);
router.post('/', authorize(Role.PHOTOGRAPHER), ctrl.create);
router.put('/:id', authorize(Role.PHOTOGRAPHER), ctrl.update);
router.post('/:id/images', authorize(Role.PHOTOGRAPHER), upload.single('image'), ctrl.addImage);
router.delete('/:id/images/:imageId', authorize(Role.PHOTOGRAPHER), ctrl.removeImage);
export default router;
