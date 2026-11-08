import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { approvalController } from '../controllers/approval.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const approvalRoutes = Router();

// 1. Sales Head Approval Queue
approvalRoutes.get(
  '/queue',
  requireAuth,
  requireRole([UserRole.SALES_HEAD]),
  approvalController.getApprovalQueue
);

export default approvalRoutes;

