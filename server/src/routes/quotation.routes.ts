import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { quotationController } from '../controllers/quotation.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const quotationRoutes = Router({ mergeParams: true });

// 1. Costing Preview: Accessible to authenticated users (ESTIMATOR & SALES_HEAD)
quotationRoutes.post('/preview', requireAuth, quotationController.previewQuotation);

// 2. Quotation Creation: Strictly restricted to ESTIMATOR role
quotationRoutes.post('/', requireAuth, requireRole([UserRole.ESTIMATOR]), quotationController.createQuotation);

// 3. List Quotations for RFQ: Accessible to authenticated users
quotationRoutes.get('/', requireAuth, quotationController.getQuotationsByRfq);

export default quotationRoutes;

