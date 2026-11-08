import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { rfqController } from '../controllers/rfq.controller';
import quotationRoutes from './quotation.routes';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const rfqRoutes = Router();

// Sub-routes for Quotations under RFQ
rfqRoutes.use('/:rfqId/quotations', quotationRoutes);

// 1. Read operations: Accessible by both ESTIMATOR and SALES_HEAD
rfqRoutes.get('/', requireAuth, rfqController.getRfqs);
rfqRoutes.get('/:id', requireAuth, rfqController.getRfqById);

// 2. Mutation operations: Strictly restricted to ESTIMATOR role
rfqRoutes.post('/', requireAuth, requireRole([UserRole.ESTIMATOR]), rfqController.createRfq);
rfqRoutes.patch('/:id', requireAuth, requireRole([UserRole.ESTIMATOR]), rfqController.updateRfq);
rfqRoutes.patch('/:id/status', requireAuth, requireRole([UserRole.ESTIMATOR]), rfqController.updateRfqStatus);

export default rfqRoutes;

