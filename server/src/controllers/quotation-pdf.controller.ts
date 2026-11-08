import { Request, Response, NextFunction } from 'express';
import { quotationPdfService } from '../services/quotation-pdf.service';

export class QuotationPdfController {
  /**
   * POST /api/quotations/:id/pdf
   * Generate or retrieve existing quotation PDF
   */
  public async generatePdf(req: Request, res: Response, next: NextFunction) {
    try {
      const quotationId = req.params.id;
      const userId = (req as any).user?.id;

      const result = await quotationPdfService.generateQuotationPdf(quotationId, userId);

      res.status(result.isExisting ? 200 : 201).json({
        status: 'success',
        message: result.isExisting
          ? 'Retrieved existing quotation PDF artifact.'
          : 'Quotation PDF generated and stored successfully.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/quotations/:id/pdf
   * Get secure download link or stream PDF directly
   */
  public async getPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const quotationId = req.params.id;
      const streamMode = req.query.stream === 'true' || req.headers.accept === 'application/pdf';

      if (streamMode) {
        const streamResult = await quotationPdfService.streamQuotationPdf(quotationId);
        res.setHeader('Content-Type', streamResult.mimeType);
        res.setHeader(
          'Content-Disposition',
          `inline; filename="${streamResult.fileName}"`
        );
        return res.send(streamResult.buffer);
      }

      const result = await quotationPdfService.getQuotationPdf(quotationId);

      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const quotationPdfController = new QuotationPdfController();
export default quotationPdfController;

