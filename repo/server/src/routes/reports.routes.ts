import { Router } from 'express';
import multer from 'multer';
import * as ctrl from '../controllers/report.controller';
import { contentFilterMiddleware } from '../middleware/contentFilter';
import { validateRequest } from '../middleware/validateRequest';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const router = Router();
router.post('/', upload.array('evidence', 5), validateRequest(ctrl.createReportSchema), contentFilterMiddleware(['description']), ctrl.create);
router.get('/my', ctrl.getMyReports);
export default router;
