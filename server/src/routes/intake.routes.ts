import { Router } from 'express';
import multer from 'multer';
import { UserRole } from '@prisma/client';
import { intakeController } from '../controllers/intake.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const intakeRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024, // 15 MB
  },
});

intakeRouter.post(
  '/upload',
  requireAuth,
  requireRole([UserRole.ESTIMATOR]),
  upload.single('file'),
  intakeController.upload
);

intakeRouter.post(
  '/extract',
  requireAuth,
  requireRole([UserRole.ESTIMATOR]),
  intakeController.extract
);

intakeRouter.post(
  '/create-rfq',
  requireAuth,
  requireRole([UserRole.ESTIMATOR]),
  intakeController.createRfq
);

intakeRouter.get(
  '/routing-suggestions',
  requireAuth,
  requireRole([UserRole.ESTIMATOR]),
  intakeController.getRoutingSuggestions
);

intakeRouter.get(
  '/:id',
  requireAuth,
  requireRole([UserRole.ESTIMATOR]),
  intakeController.getDraft
);

export default intakeRouter;

