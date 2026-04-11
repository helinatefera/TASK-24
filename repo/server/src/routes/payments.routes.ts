import { Router } from 'express';
import * as paymentCtrl from '../controllers/payment.controller';
import * as settlementCtrl from '../controllers/settlement.controller';
import { validateRequest } from '../middleware/validateRequest';
import { authorize } from '../middleware/authorize';
import { Role } from '../types/enums';

const router = Router();
// Settlement operations (mounted at /api/settlements)
router.get('/:id', authorize(Role.ALUMNI, Role.PHOTOGRAPHER, Role.ADMIN), validateRequest(settlementCtrl.settlementIdParamSchema, 'params'), settlementCtrl.getById);
router.patch('/:id/approve', authorize(Role.ALUMNI, Role.PHOTOGRAPHER, Role.ADMIN), validateRequest(settlementCtrl.settlementIdParamSchema, 'params'), settlementCtrl.approve);
router.post('/:id/adjustment', authorize(Role.ALUMNI, Role.PHOTOGRAPHER, Role.ADMIN), validateRequest(settlementCtrl.settlementIdParamSchema, 'params'), settlementCtrl.addAdjustment);
router.get('/:id/export/pdf', authorize(Role.ALUMNI, Role.PHOTOGRAPHER, Role.ADMIN), validateRequest(settlementCtrl.settlementIdParamSchema, 'params'), settlementCtrl.exportPDF);
router.get('/:id/export/csv', authorize(Role.ALUMNI, Role.PHOTOGRAPHER, Role.ADMIN), validateRequest(settlementCtrl.settlementIdParamSchema, 'params'), settlementCtrl.exportCSV);
// Payment operations
router.post('/:id/payments', authorize(Role.ALUMNI, Role.PHOTOGRAPHER, Role.ADMIN), validateRequest(paymentCtrl.settlementIdParamSchema, 'params'), validateRequest(paymentCtrl.recordPaymentSchema), paymentCtrl.recordPayment);
router.get('/:id/payments', authorize(Role.ALUMNI, Role.PHOTOGRAPHER, Role.ADMIN), validateRequest(paymentCtrl.settlementIdParamSchema, 'params'), paymentCtrl.getBySettlement);
export default router;
