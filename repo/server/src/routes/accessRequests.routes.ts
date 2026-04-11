import { Router } from 'express';
import * as ctrl from '../controllers/accessRequest.controller';
import { validateRequest } from '../middleware/validateRequest';
import { authorize } from '../middleware/authorize';
import { Role } from '../types/enums';

const router = Router();
router.post('/', authorize(Role.ALUMNI, Role.PHOTOGRAPHER, Role.ADMIN), validateRequest(ctrl.createRequestSchema), ctrl.createRequest);
router.get('/incoming', authorize(Role.ALUMNI, Role.PHOTOGRAPHER, Role.ADMIN), ctrl.getIncoming);
router.get('/outgoing', authorize(Role.ALUMNI, Role.PHOTOGRAPHER, Role.ADMIN), ctrl.getOutgoing);
router.patch('/:id/respond', authorize(Role.ALUMNI, Role.PHOTOGRAPHER, Role.ADMIN), validateRequest(ctrl.respondToRequestSchema), ctrl.respondToRequest);
// Convenience routes for client: PATCH /:id/approve and /:id/deny
router.patch('/:id/approve', authorize(Role.ALUMNI, Role.PHOTOGRAPHER, Role.ADMIN), async (req, res, next) => {
  req.body.status = 'approved';
  return ctrl.respondToRequest(req, res, next);
});
router.patch('/:id/deny', authorize(Role.ALUMNI, Role.PHOTOGRAPHER, Role.ADMIN), async (req, res, next) => {
  req.body.status = 'denied';
  return ctrl.respondToRequest(req, res, next);
});
export default router;
