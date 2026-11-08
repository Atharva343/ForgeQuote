import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { rateController } from '../controllers/rate.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const rateRoutes = Router();

// =========================================================================
// MATERIAL RATES
// =========================================================================

// Read: Both ESTIMATOR and SALES_HEAD
rateRoutes.get('/materials', requireAuth, rateController.getMaterialRates);
rateRoutes.get('/materials/:materialCode/history', requireAuth, rateController.getMaterialRateHistory);

// Write: Strictly ESTIMATOR
rateRoutes.post('/materials', requireAuth, requireRole([UserRole.ESTIMATOR]), rateController.createMaterialRate);
rateRoutes.patch('/materials/:id/close', requireAuth, requireRole([UserRole.ESTIMATOR]), rateController.closeMaterialRate);

// =========================================================================
// MACHINE RATES
// =========================================================================

// Read: Both ESTIMATOR and SALES_HEAD
rateRoutes.get('/machines', requireAuth, rateController.getMachineRates);
rateRoutes.get('/machines/:operationCode/history', requireAuth, rateController.getMachineRateHistory);

// Write: Strictly ESTIMATOR
rateRoutes.post('/machines', requireAuth, requireRole([UserRole.ESTIMATOR]), rateController.createMachineRate);
rateRoutes.patch('/machines/:id/close', requireAuth, requireRole([UserRole.ESTIMATOR]), rateController.closeMachineRate);

export default rateRoutes;

