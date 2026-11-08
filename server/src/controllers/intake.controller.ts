import { Request, Response, NextFunction } from 'express';
import { intakeService } from '../services/intake.service';
import {
  extractIntakeInputSchema,
  createRfqFromIntakeSchema,
} from '../validators/intake.validator';

export class IntakeController {
  /**
   * POST /api/rfq-intake/upload
   * Upload and privately store intake document
   */
  public async upload(req: Request, res: Response, next: NextFunction) {
    try {
      const file = req.file;
      const userId = (req as any).user?.id;
      const draftId = req.body?.draftId;

      const result = await intakeService.uploadDocument(file as any, userId, draftId);

      res.status(201).json({
        status: 'success',
        message: 'Intake document uploaded and stored in private storage.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/rfq-intake/extract
   * Extract RFQ details from email text and uploaded documents
   */
  public async extract(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      const input = extractIntakeInputSchema.parse(req.body);

      const result = await intakeService.extractIntakeData(
        userId,
        input.emailText,
        input.documentIds,
        input.draftId
      );

      res.status(200).json({
        status: 'success',
        message: 'Extraction completed.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/rfq-intake/create-rfq
   * Create confirmed RFQ from estimator-reviewed intake values
   */
  public async createRfq(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      const input = createRfqFromIntakeSchema.parse(req.body);

      const result = await intakeService.createRfqFromConfirmedIntake(userId, input);

      res.status(201).json({
        status: 'success',
        message: `RFQ ${result.rfq.rfqNumber} successfully created from confirmed intake.`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/rfq-intake/:id
   * Retrieve saved intake draft
   */
  public async getDraft(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      const draftId = req.params.id;

      const result = await intakeService.getDraftById(draftId, userId);

      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/rfq-intake/routing-suggestions
   * Retrieve historical routing suggestions for a part
   */
  public async getRoutingSuggestions(req: Request, res: Response, next: NextFunction) {
    try {
      const partName = String(req.query.partName || '');
      const material = String(req.query.material || '');

      const suggestions = await intakeService.getHistoricalRoutingSuggestions(
        partName,
        material
      );

      res.status(200).json({
        status: 'success',
        data: suggestions,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const intakeController = new IntakeController();
export default intakeController;

