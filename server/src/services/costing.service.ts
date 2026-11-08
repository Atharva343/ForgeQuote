import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { CostingInput } from '../validators/quotation.validator';

export interface OperationCostDetail {
  sequence: number;
  operationName: string;
  machineCode: string;
  machineName: string;
  hourlyRate: number;
  setupTimeMinutes: number;
  cycleTimeMinutes: number;
  cycleCost: number;
  setupCost: number;
  totalOperationCost: number;
}

export interface VolumeScenarioResult {
  productionVolume: number;
  materialCost: number;
  processCost: number;
  scrapCost: number;
  overheadCost: number;
  freightCost: number;
  totalCost: number;
  marginPercentage: number;
  sellingPriceBeforeGst: number;
  gstPercentage: number;
  gstAmount: number;
  sellingPriceWithGst: number;
  annualValue: number;
  operationDetails: OperationCostDetail[];
}

export interface CostingCalculationResult {
  rfqPart: {
    id: string;
    partName: string;
    partNumber?: string | null;
    drawingNumber?: string | null;
    material: string;
    grossWeightKg: number;
    annualVolume: number;
  };
  quotationDate: string;
  rateSnapshot: {
    quotationDate: string;
    material: {
      id: string;
      materialCode: string;
      materialName: string;
      ratePerKg: number;
      currency: string;
      validFrom: string;
      validTo: string | null;
    };
    routingOperations: Array<{
      id: string;
      sequence: number;
      operationName: string;
      machineCode: string;
      machineName: string;
      hourlyRate: number;
      currency: string;
      setupTimeMinutes: number;
      cycleTimeMinutes: number;
      validFrom: string;
      validTo: string | null;
    }>;
  };
  costBreakdown: {
    scrapPercentage: number;
    overheadPercentage: number;
    freightPerUnit: number;
    marginPercentage: number;
    gstPercentage: number;
    annualProductionVolume: number;
  };
  scenarios: VolumeScenarioResult[];
}

export class CostingService {
  /**
   * Resolves effective material rate for quotationDate or throws a structured descriptive error.
   */
  async resolveEffectiveMaterialRate(materialCode: string, quotationDate: Date) {
    const effectiveRate = await prisma.materialRate.findFirst({
      where: {
        materialCode: {
          equals: materialCode.trim(),
          mode: 'insensitive',
        },
        validFrom: {
          lte: quotationDate,
        },
        OR: [{ validTo: null }, { validTo: { gte: quotationDate } }],
      },
      orderBy: {
        validFrom: 'desc',
      },
    });

    if (effectiveRate) {
      return effectiveRate;
    }

    // Inspect if rate is missing, expired, or future
    const anyRate = await prisma.materialRate.findFirst({
      where: {
        materialCode: {
          equals: materialCode.trim(),
          mode: 'insensitive',
        },
      },
      orderBy: {
        validFrom: 'desc',
      },
    });

    const dateStr = quotationDate.toISOString().split('T')[0];

    if (!anyRate) {
      const error: AppError = new Error(
        `No material rate found for material '${materialCode}'. Please configure an effective rate in Rate Masters first.`
      );
      error.statusCode = 400;
      throw error;
    }

    if (anyRate.validTo && anyRate.validTo < quotationDate) {
      const error: AppError = new Error(
        `Material rate for '${materialCode}' expired on ${anyRate.validTo.toISOString().split('T')[0]}. No rate is effective for quotation date ${dateStr}.`
      );
      error.statusCode = 400;
      throw error;
    }

    if (anyRate.validFrom > quotationDate) {
      const error: AppError = new Error(
        `Material rate for '${materialCode}' is scheduled for the future (${anyRate.validFrom.toISOString().split('T')[0]}). Not effective for quotation date ${dateStr}.`
      );
      error.statusCode = 400;
      throw error;
    }

    const error: AppError = new Error(
      `No effective material rate available for material '${materialCode}' on date ${dateStr}.`
    );
    error.statusCode = 400;
    throw error;
  }

  /**
   * Resolves effective machine hourly rate for quotationDate or throws a structured descriptive error.
   */
  async resolveEffectiveMachineRate(machineCode: string, quotationDate: Date) {
    const effectiveRate = await prisma.machineRate.findFirst({
      where: {
        operationCode: {
          equals: machineCode.trim(),
          mode: 'insensitive',
        },
        validFrom: {
          lte: quotationDate,
        },
        OR: [{ validTo: null }, { validTo: { gte: quotationDate } }],
      },
      orderBy: {
        validFrom: 'desc',
      },
    });

    if (effectiveRate) {
      return effectiveRate;
    }

    const anyRate = await prisma.machineRate.findFirst({
      where: {
        operationCode: {
          equals: machineCode.trim(),
          mode: 'insensitive',
        },
      },
      orderBy: {
        validFrom: 'desc',
      },
    });

    const dateStr = quotationDate.toISOString().split('T')[0];

    if (!anyRate) {
      const error: AppError = new Error(
        `No machine rate found for machine code '${machineCode}'. Please configure an effective machine rate in Rate Masters.`
      );
      error.statusCode = 400;
      throw error;
    }

    if (anyRate.validTo && anyRate.validTo < quotationDate) {
      const error: AppError = new Error(
        `Machine rate for '${machineCode}' expired on ${anyRate.validTo.toISOString().split('T')[0]}. No rate is effective for quotation date ${dateStr}.`
      );
      error.statusCode = 400;
      throw error;
    }

    if (anyRate.validFrom > quotationDate) {
      const error: AppError = new Error(
        `Machine rate for '${machineCode}' becomes effective in the future on ${anyRate.validFrom.toISOString().split('T')[0]}. Not effective for quotation date ${dateStr}.`
      );
      error.statusCode = 400;
      throw error;
    }

    const error: AppError = new Error(
      `No effective machine rate available for operation code '${machineCode}' on date ${dateStr}.`
    );
    error.statusCode = 400;
    throw error;
  }

  /**
   * Deterministic Costing Engine using Prisma.Decimal arbitrary-precision arithmetic
   */
  async calculateCosting(
    rfqPartId: string,
    input: CostingInput
  ): Promise<CostingCalculationResult> {
    const quoteDate = input.quotationDate ? new Date(input.quotationDate) : new Date();

    // 1. Fetch part and routing operations
    const part = await prisma.rfqPart.findUnique({
      where: { id: rfqPartId },
      include: {
        routingOperations: {
          orderBy: { sequence: 'asc' },
        },
      },
    });

    if (!part) {
      const error: AppError = new Error(`RFQ part with ID '${rfqPartId}' not found`);
      error.statusCode = 404;
      throw error;
    }

    if (part.routingOperations.length === 0) {
      const error: AppError = new Error(
        `Part '${part.partName}' has no routing operations defined. At least one routing operation is required for costing.`
      );
      error.statusCode = 400;
      throw error;
    }

    // 2. Resolve Effective Material Rate
    const materialRate = await this.resolveEffectiveMaterialRate(part.material, quoteDate);

    // 3. Resolve Effective Machine Rates for all Routing Operations
    const resolvedOperations = await Promise.all(
      part.routingOperations.map(async (op) => {
        const rate = await this.resolveEffectiveMachineRate(op.machineCode, quoteDate);
        return {
          operation: op,
          rate,
        };
      })
    );

    // 4. Decimal Arithmetic Costing Engine
    const grossWeight = new Prisma.Decimal(part.grossWeightKg);
    const matRatePerKg = new Prisma.Decimal(materialRate.ratePerKg);
    const scrapPct = new Prisma.Decimal(input.scrapPercentage);
    const overheadPct = new Prisma.Decimal(input.overheadPercentage);
    const freightAmount = new Prisma.Decimal(input.freightPerUnit);
    const marginPct = new Prisma.Decimal(input.marginPercentage);
    const gstPct = new Prisma.Decimal(input.gstPercentage);
    const annualVol = new Prisma.Decimal(part.annualVolume);

    // Constant: Material Cost per Unit = Gross Weight (kg) × Material Rate (₹/kg)
    const materialCost = grossWeight.mul(matRatePerKg).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);

    // Constant: Scrap Cost per Unit = Material Cost × Scrap Percentage / 100
    const scrapCost = materialCost.mul(scrapPct).div(100).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);

    // 5. Calculate Scenarios for each Production Volume
    const scenarios: VolumeScenarioResult[] = input.volumeScenarios.map((vol) => {
      const Q = new Prisma.Decimal(vol);
      let totalProcessCost = new Prisma.Decimal(0);

      const operationDetails: OperationCostDetail[] = resolvedOperations.map(({ operation, rate }) => {
        const cycleTime = new Prisma.Decimal(operation.cycleTimeMinutes);
        const setupTime = new Prisma.Decimal(operation.setupTimeMinutes);
        const hourlyRate = new Prisma.Decimal(rate.hourlyRate);

        // Cycle Cost per Unit = (Cycle Time Minutes × Machine Hourly Rate) / 60
        const cycleCost = cycleTime.mul(hourlyRate).div(60).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);

        // Setup Cost per Unit = (Setup Time Minutes × Machine Hourly Rate) / (60 × Production Batch Quantity)
        const setupCost = setupTime.mul(hourlyRate).div(new Prisma.Decimal(60).mul(Q)).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);

        const opTotal = cycleCost.add(setupCost).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
        totalProcessCost = totalProcessCost.add(opTotal);

        return {
          sequence: operation.sequence,
          operationName: operation.operationName,
          machineCode: operation.machineCode,
          machineName: rate.machineName,
          hourlyRate: Number(rate.hourlyRate),
          setupTimeMinutes: Number(operation.setupTimeMinutes),
          cycleTimeMinutes: Number(operation.cycleTimeMinutes),
          cycleCost: cycleCost.toNumber(),
          setupCost: setupCost.toNumber(),
          totalOperationCost: opTotal.toNumber(),
        };
      });

      totalProcessCost = totalProcessCost.toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);

      // Overhead Cost per Unit = (Material Cost + Process Cost + Scrap Cost) × Overhead Percentage / 100
      const overheadBase = materialCost.add(totalProcessCost).add(scrapCost);
      const overheadCost = overheadBase.mul(overheadPct).div(100).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);

      // Total Cost per Unit = Material + Process + Scrap + Overhead + Freight
      const totalCost = materialCost
        .add(totalProcessCost)
        .add(scrapCost)
        .add(overheadCost)
        .add(freightAmount)
        .toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);

      // Selling Price Before GST = Total Cost / (1 - Margin Percentage / 100)
      const marginDivisor = new Prisma.Decimal(1).sub(marginPct.div(100));
      const sellingPriceBeforeGst = totalCost.div(marginDivisor).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);

      // GST Amount per Unit = Selling Price Before GST × GST Percentage / 100
      const gstAmount = sellingPriceBeforeGst.mul(gstPct).div(100).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);

      // Selling Price Including GST = Selling Price Before GST + GST Amount
      const sellingPriceWithGst = sellingPriceBeforeGst.add(gstAmount).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);

      // Annual Quotation Value (Pre-GST) = Selling Price Before GST × Annual Production Volume
      const annualValue = sellingPriceBeforeGst.mul(annualVol).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);

      return {
        productionVolume: vol,
        materialCost: materialCost.toNumber(),
        processCost: totalProcessCost.toNumber(),
        scrapCost: scrapCost.toNumber(),
        overheadCost: overheadCost.toNumber(),
        freightCost: freightAmount.toNumber(),
        totalCost: totalCost.toNumber(),
        marginPercentage: Number(input.marginPercentage),
        sellingPriceBeforeGst: sellingPriceBeforeGst.toNumber(),
        gstPercentage: Number(input.gstPercentage),
        gstAmount: gstAmount.toNumber(),
        sellingPriceWithGst: sellingPriceWithGst.toNumber(),
        annualValue: annualValue.toNumber(),
        operationDetails,
      };
    });

    // 6. Build Snapshot
    const rateSnapshot = {
      quotationDate: quoteDate.toISOString(),
      material: {
        id: materialRate.id,
        materialCode: materialRate.materialCode,
        materialName: materialRate.materialName,
        ratePerKg: Number(materialRate.ratePerKg),
        currency: materialRate.currency,
        validFrom: materialRate.validFrom.toISOString(),
        validTo: materialRate.validTo ? materialRate.validTo.toISOString() : null,
      },
      routingOperations: resolvedOperations.map(({ operation, rate }) => ({
        id: rate.id,
        sequence: operation.sequence,
        operationName: operation.operationName,
        machineCode: operation.machineCode,
        machineName: rate.machineName,
        hourlyRate: Number(rate.hourlyRate),
        currency: rate.currency,
        setupTimeMinutes: Number(operation.setupTimeMinutes),
        cycleTimeMinutes: Number(operation.cycleTimeMinutes),
        validFrom: rate.validFrom.toISOString(),
        validTo: rate.validTo ? rate.validTo.toISOString() : null,
      })),
    };

    const costBreakdown = {
      scrapPercentage: Number(input.scrapPercentage),
      overheadPercentage: Number(input.overheadPercentage),
      freightPerUnit: Number(input.freightPerUnit),
      marginPercentage: Number(input.marginPercentage),
      gstPercentage: Number(input.gstPercentage),
      annualProductionVolume: part.annualVolume,
    };

    return {
      rfqPart: {
        id: part.id,
        partName: part.partName,
        partNumber: part.partNumber,
        drawingNumber: part.drawingNumber,
        material: part.material,
        grossWeightKg: Number(part.grossWeightKg),
        annualVolume: part.annualVolume,
      },
      quotationDate: quoteDate.toISOString(),
      rateSnapshot,
      costBreakdown,
      scenarios,
    };
  }
}

export const costingService = new CostingService();

