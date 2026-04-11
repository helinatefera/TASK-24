import { Router } from 'express';
import * as ctrl from '../controllers/sensitiveWord.controller';
import { authorize } from '../middleware/authorize';
import { Role } from '../types/enums';

const router = Router();
router.get('/sensitive-words', authorize(Role.ADMIN), ctrl.getAll);
router.post('/sensitive-words', authorize(Role.ADMIN), ctrl.create);
router.delete('/sensitive-words/:id', authorize(Role.ADMIN), ctrl.remove);
export default router;
