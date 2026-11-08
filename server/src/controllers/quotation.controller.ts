import { Request, Response, NextFunction } from 'express';
import { quotationService } from '../services/quotation.service';
import { costingInputSchema } from '../validators/quotation.validator';

export class QuotationController {
  /**
   * POST /api/rfqs/:rfqId/quotations/preview
   */
  async previewQuotation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { rfqId } = req.params;
      const input = costingInputSchema.parse(req.body);

      const preview = await quotationService.previewQuotation(rfqId, input);

      res.json({
        status: 'success',
        data: preview,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/rfqs/:rfqId/quotations
   */
  async createQuotation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { rfqId } = req.params;
      const input = costingInputSchema.parse(req.body);
      const userId = req.user!.id;

      const quotation = await quotationService.createQuotation(rfqId, userId, input);

      res.status(201).json({
        status: 'success',
        data: { quotation },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/rfqs/:rfqId/quotations
   */
  async getQuotationsByRfq(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { rfqId } = req.params;
      const quotations = await quotationService.getQuotationsByRfq(rfqId);

      res.json({
        status: 'success',
        data: { quotations },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/quotations/:id
   */
  async getQuotationById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const quotation = await quotationService.getQuotationById(id);

      res.json({
        status: 'success',
        data: { quotation },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const quotationController = new QuotationController();

