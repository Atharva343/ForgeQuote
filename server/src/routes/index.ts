import { Router } from 'express';
import { UserRole } from '@prisma/client';
import healthRoutes from './health.routes';
import authRoutes from './auth.routes';
import customerRoutes from './customer.routes';
import rfqRoutes from './rfq.routes';
import rateRoutes from './rate.routes';
import approvalRoutes from './approval.routes';
import intakeRoutes from './intake.routes';
import historicalQuoteRoutes from './historical-quote.routes';
import { quotationController } from '../controllers/quotation.controller';
import { approvalController } from '../controllers/approval.controller';
import { quotationPdfController } from '../controllers/quotation-pdf.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const apiRouter = Router();

apiRouter.use('/health', healthRoutes);
apiRouter.use('/auth', authRoutes);
apiRouter.use('/customers', customerRoutes);
apiRouter.use('/rfqs', rfqRoutes);
apiRouter.use('/rates', rateRoutes);
apiRouter.use('/approvals', approvalRoutes);
apiRouter.use('/rfq-intake', intakeRoutes);
apiRouter.use('/historical-quotes', historicalQuoteRoutes);

// Direct quotation lookup
apiRouter.get('/quotations/:id', requireAuth, quotationController.getQuotationById);

// Quotation Approval Workflow endpoints
apiRouter.post(
  '/quotations/:id/submit',
  requireAuth,
  requireRole([UserRole.ESTIMATOR]),
  approvalController.submitQuotation
);

apiRouter.post(
  '/quotations/:id/approve',
  requireAuth,
  requireRole([UserRole.SALES_HEAD]),
  approvalController.approveQuotation
);

apiRouter.post(
  '/quotations/:id/reject',
  requireAuth,
  requireRole([UserRole.SALES_HEAD]),
  approvalController.rejectQuotation
);

apiRouter.get(
  '/quotations/:id/approval-history',
  requireAuth,
  approvalController.getApprovalHistory
);

// Quotation PDF Generation & Download endpoints
apiRouter.post(
  '/quotations/:id/pdf',
  requireAuth,
  requireRole([UserRole.ESTIMATOR, UserRole.SALES_HEAD]),
  quotationPdfController.generatePdf
);

apiRouter.get(
  '/quotations/:id/pdf',
  requireAuth,
  requireRole([UserRole.ESTIMATOR, UserRole.SALES_HEAD]),
  quotationPdfController.getPdf
);

// Role authorization verification endpoints (accessible in test/dev)
if (process.env.NODE_ENV !== 'production') {
  apiRouter.get(
    '/test/estimator-only',
    requireAuth,
    requireRole([UserRole.ESTIMATOR]),
    (_req, res) => {
      res.json({ status: 'success', message: 'Estimator access granted' });
    }
  );

  apiRouter.get(
    '/test/sales-head-only',
    requireAuth,
    requireRole([UserRole.SALES_HEAD]),
    (_req, res) => {
      res.json({ status: 'success', message: 'Sales Head access granted' });
    }
  );
}

export default apiRouter;
