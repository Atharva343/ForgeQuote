import { Request, Response, NextFunction } from 'express';
import { rfqService } from '../services/rfq.service';
import {
  createRfqSchema,
  updateRfqSchema,
  updateRfqStatusSchema,
  rfqQuerySchema,
} from '../validators/rfq.validator';

export class RfqController {
  /**
   * GET /api/rfqs
   */
  async getRfqs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = rfqQuerySchema.parse(req.query);
      const result = await rfqService.getRfqs(query);

      res.json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/rfqs/:id
   */
  async getRfqById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const rfq = await rfqService.getRfqById(id);

      res.json({
        status: 'success',
        data: { rfq },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/rfqs
   */
  async createRfq(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createRfqSchema.parse(req.body);
      const userId = req.user!.id;
      const rfq = await rfqService.createRfq(userId, input);

      res.status(201).json({
        status: 'success',
        data: { rfq },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/rfqs/:id
   */
  async updateRfq(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const input = updateRfqSchema.parse(req.body);
      const userId = req.user!.id;
      const userRole = req.user!.role;

      const rfq = await rfqService.updateRfq(id, userId, userRole, input);

      res.json({
        status: 'success',
        data: { rfq },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/rfqs/:id/status
   */
  async updateRfqStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const input = updateRfqStatusSchema.parse(req.body);

      const rfq = await rfqService.updateRfqStatus(id, input);

      res.json({
        status: 'success',
        data: { rfq },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const rfqController = new RfqController();

