import { Request, Response, NextFunction } from 'express';
import { rateService } from '../services/rate.service';
import {
  createMaterialRateSchema,
  createMachineRateSchema,
  closeRateSchema,
  rateQuerySchema,
} from '../validators/rate.validator';

export class RateController {
  // =========================================================================
  // MATERIAL RATES
  // =========================================================================

  /**
   * GET /api/rates/materials
   */
  async getMaterialRates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = rateQuerySchema.parse(req.query);
      const result = await rateService.getMaterialRates(query);

      res.json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/rates/materials/:materialCode/history
   */
  async getMaterialRateHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { materialCode } = req.params;
      const history = await rateService.getMaterialRateHistory(materialCode);

      res.json({
        status: 'success',
        data: {
          materialCode,
          history,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/rates/materials
   */
  async createMaterialRate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createMaterialRateSchema.parse(req.body);
      const rate = await rateService.createMaterialRate(input);

      res.status(201).json({
        status: 'success',
        data: { rate },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/rates/materials/:id/close
   */
  async closeMaterialRate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const input = closeRateSchema.parse(req.body);
      const rate = await rateService.closeMaterialRate(id, input);

      res.json({
        status: 'success',
        data: { rate },
      });
    } catch (error) {
      next(error);
    }
  }

  // =========================================================================
  // MACHINE RATES
  // =========================================================================

  /**
   * GET /api/rates/machines
   */
  async getMachineRates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = rateQuerySchema.parse(req.query);
      const result = await rateService.getMachineRates(query);

      res.json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/rates/machines/:operationCode/history
   */
  async getMachineRateHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { operationCode } = req.params;
      const history = await rateService.getMachineRateHistory(operationCode);

      res.json({
        status: 'success',
        data: {
          operationCode,
          history,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/rates/machines
   */
  async createMachineRate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createMachineRateSchema.parse(req.body);
      const rate = await rateService.createMachineRate(input);

      res.status(201).json({
        status: 'success',
        data: { rate },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/rates/machines/:id/close
   */
  async closeMachineRate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const input = closeRateSchema.parse(req.body);
      const rate = await rateService.closeMachineRate(id, input);

      res.json({
        status: 'success',
        data: { rate },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const rateController = new RateController();

