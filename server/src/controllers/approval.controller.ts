import { Request, Response, NextFunction } from 'express';
import { approvalService } from '../services/approval.service';
import {
  submitQuotationSchema,
  approveQuotationSchema,
  rejectQuotationSchema,
  approvalQueueQuerySchema,
} from '../validators/approval.validator';

export class ApprovalController {
  /**
   * POST /api/quotations/:id/submit
   * ESTIMATOR only
   */
  async submitQuotation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const estimatorId = req.user!.id;
      const body = submitQuotationSchema.parse(req.body || {});

      const result = await approvalService.submitQuotation(id, estimatorId, body.comments);

      res.json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/approvals/queue
   * SALES_HEAD only
   */
  async getApprovalQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = approvalQueueQuerySchema.parse(req.query);
      const result = await approvalService.getApprovalQueue(query);

      res.json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/quotations/:id/approve
   * SALES_HEAD only
   */
  async approveQuotation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const salesHeadId = req.user!.id;
      const body = approveQuotationSchema.parse(req.body || {});

      const result = await approvalService.approveQuotation(id, salesHeadId, body.comments);

      res.json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/quotations/:id/reject
   * SALES_HEAD only
   */
  async rejectQuotation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const salesHeadId = req.user!.id;
      const body = rejectQuotationSchema.parse(req.body || {});

      const result = await approvalService.rejectQuotation(id, salesHeadId, body.reason);

      res.json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/quotations/:id/approval-history
   * Authenticated users
   */
  async getApprovalHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const result = await approvalService.getApprovalHistory(id);

      res.json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const approvalController = new ApprovalController();

