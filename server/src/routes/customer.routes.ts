import { Router } from 'express';
import { customerController } from '../controllers/customer.controller';
import { requireAuth } from '../middleware/auth.middleware';

const customerRoutes = Router();

// Authenticated users (both ESTIMATOR and SALES_HEAD) can view customers
customerRoutes.get('/', requireAuth, customerController.getCustomers);

export default customerRoutes;

