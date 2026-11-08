import { Router } from 'express';
import multer from 'multer';
import { UserRole } from '@prisma/client';
import { historicalQuoteController } from '../controllers/historical-quote.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const historicalQuoteRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB max file size
  },
});

// 1. Estimator-only import workflows
historicalQuoteRouter.post(
  '/upload-preview',
  requireAuth,
  requireRole([UserRole.ESTIMATOR]),
  upload.single('file'),
  historicalQuoteController.uploadPreview
);

historicalQuoteRouter.post(
  '/validate',
  requireAuth,
  requireRole([UserRole.ESTIMATOR]),
  upload.single('file'),
  historicalQuoteController.validateImport
);

historicalQuoteRouter.post(
  '/confirm-import',
  requireAuth,
  requireRole([UserRole.ESTIMATOR]),
  historicalQuoteController.confirmImport
);

// 2. Authenticated search and retrieval (Both ESTIMATOR and SALES_HEAD)
historicalQuoteRouter.get(
  '/similar',
  requireAuth,
  historicalQuoteController.getSimilarParts
);

historicalQuoteRouter.get(
  '/',
  requireAuth,
  historicalQuoteController.searchQuotes
);

historicalQuoteRouter.get(
  '/:id',
  requireAuth,
  historicalQuoteController.getQuoteById
);

export default historicalQuoteRouter;

