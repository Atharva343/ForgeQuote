import { Request, Response, NextFunction } from 'express';
import { historicalQuoteService } from '../services/historical-quote.service';
import {
  HistoricalQuoteQuerySchema,
  SimilarPartQuerySchema,
  ColumnMappingSchema,
} from '../validators/historical-quote.validator';
import { AppError } from '../middleware/errorHandler';

export class HistoricalQuoteController {
  /**
   * POST /api/historical-quotes/upload-preview
   * Estimator uploads Excel/CSV, extracts headers, row count, sample preview & suggested mapping
   */
  public async uploadPreview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new AppError('No spreadsheet file uploaded.', 400);
      }

      const lower = req.file.originalname.toLowerCase();
      if (lower.endsWith('.xls')) {
        throw new AppError(
          'Legacy binary Excel format (.xls) is not supported. Please convert your file to modern Excel (.xlsx) or CSV (.csv) before uploading.',
          400
        );
      }
      if (!lower.endsWith('.xlsx') && !lower.endsWith('.csv')) {
        throw new AppError('Only .xlsx and .csv spreadsheet formats are supported.', 400);
      }

      const result = await historicalQuoteService.parseExcelHeadersAndPreview(
        req.file.buffer,
        req.file.originalname
      );

      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/historical-quotes/validate
   * Validates all rows in spreadsheet using provided column mapping
   */
  public async validateImport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new AppError('Spreadsheet file is required for validation.', 400);
      }

      const valLower = req.file.originalname.toLowerCase();
      if (valLower.endsWith('.xls')) {
        throw new AppError(
          'Legacy binary Excel format (.xls) is not supported. Please convert your file to modern Excel (.xlsx) or CSV (.csv) before uploading.',
          400
        );
      }
      if (!valLower.endsWith('.xlsx') && !valLower.endsWith('.csv')) {
        throw new AppError('Only .xlsx and .csv spreadsheet formats are supported.', 400);
      }

      let columnMapping: any;
      try {
        columnMapping = typeof req.body.columnMapping === 'string'
          ? JSON.parse(req.body.columnMapping)
          : req.body.columnMapping;
      } catch {
        throw new AppError('Invalid columnMapping JSON payload.', 400);
      }

      const parsedMapping = ColumnMappingSchema.parse(columnMapping);
      const sheetName = req.body.sheetName as string | undefined;
      const allowDuplicates = req.body.allowDuplicates === 'true' || req.body.allowDuplicates === true;

      const result = await historicalQuoteService.validateHistoricalRows(
        req.file.buffer,
        req.file.originalname,
        sheetName,
        parsedMapping,
        allowDuplicates
      );

      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/historical-quotes/confirm-import
   * Commits validated historical quotes into database in transactional/chunked batches
   */
  public async confirmImport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        throw new AppError('Unauthorized', 401);
      }

      const { fileName, validRows, errorSummary } = req.body;

      if (!fileName || typeof fileName !== 'string') {
        throw new AppError('fileName is required.', 400);
      }

      if (!validRows || !Array.isArray(validRows) || validRows.length === 0) {
        throw new AppError('validRows array must not be empty.', 400);
      }

      const summary = await historicalQuoteService.confirmHistoricalImport(
        userId,
        fileName,
        validRows,
        errorSummary || []
      );

      res.status(201).json({
        status: 'success',
        message: `Successfully imported ${summary.importedRows} historical quotation records.`,
        data: summary,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/historical-quotes
   * Search and filter historical quotes with server-side pagination & sorting
   */
  public async searchQuotes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedParams = HistoricalQuoteQuerySchema.parse(req.query);
      const result = await historicalQuoteService.searchHistoricalQuotes(validatedParams);

      res.status(200).json({
        status: 'success',
        data: result.records,
        pagination: result.pagination,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/historical-quotes/:id
   * Get historical quote record details including batch and source provenance
   */
  public async getQuoteById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const record = await historicalQuoteService.getHistoricalQuoteById(id);

      res.status(200).json({
        status: 'success',
        data: record,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/historical-quotes/similar
   * Explainable similar-part retrieval
   */
  public async getSimilarParts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedQuery = SimilarPartQuerySchema.parse(req.query);
      const result = await historicalQuoteService.findSimilarParts(validatedQuery);

      res.status(200).json({
        status: 'success',
        data: result.results,
        message: result.message,
        disclaimer: result.disclaimer,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const historicalQuoteController = new HistoricalQuoteController();

