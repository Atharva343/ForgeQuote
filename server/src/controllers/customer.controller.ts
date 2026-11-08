import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';

export class CustomerController {
  /**
   * GET /api/customers
   * Returns sorted customer choices for RFQ creation and filtering.
   */
  async getCustomers(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customers = await prisma.customer.findMany({
        select: {
          id: true,
          name: true,
          industry: true,
          contactEmail: true,
          _count: {
            select: {
              rfqs: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      });

      res.json({
        status: 'success',
        data: {
          customers,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const customerController = new CustomerController();

