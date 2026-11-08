import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import {
  CreateMaterialRateInput,
  CreateMachineRateInput,
  CloseRateInput,
  RateQueryInput,
} from '../validators/rate.validator';

export class RateService {
  /**
   * Helper to determine rate validity status relative to current timestamp
   */
  private calculateStatus(validFrom: Date, validTo: Date | null) {
    const now = new Date();
    if (now < validFrom) {
      return 'UPCOMING';
    }
    if (validTo !== null && now > validTo) {
      return 'EXPIRED';
    }
    return 'CURRENT';
  }

  /**
   * Format MaterialRate record for JSON serialization
   */
  private formatMaterialRate(rate: any) {
    if (!rate) return rate;
    const status = this.calculateStatus(new Date(rate.validFrom), rate.validTo ? new Date(rate.validTo) : null);
    return {
      id: rate.id,
      materialCode: rate.materialCode,
      materialName: rate.materialName,
      ratePerKg: rate.ratePerKg ? Number(rate.ratePerKg) : 0,
      currency: rate.currency,
      validFrom: rate.validFrom,
      validTo: rate.validTo,
      status,
      isCurrent: status === 'CURRENT',
      createdAt: rate.createdAt,
      updatedAt: rate.updatedAt,
    };
  }

  /**
   * Format MachineRate record for JSON serialization
   */
  private formatMachineRate(rate: any) {
    if (!rate) return rate;
    const status = this.calculateStatus(new Date(rate.validFrom), rate.validTo ? new Date(rate.validTo) : null);
    return {
      id: rate.id,
      operationCode: rate.operationCode,
      operationName: rate.operationName,
      machineName: rate.machineName,
      hourlyRate: rate.hourlyRate ? Number(rate.hourlyRate) : 0,
      currency: rate.currency,
      validFrom: rate.validFrom,
      validTo: rate.validTo,
      status,
      isCurrent: status === 'CURRENT',
      createdAt: rate.createdAt,
      updatedAt: rate.updatedAt,
    };
  }

  // =========================================================================
  // MATERIAL RATES
  // =========================================================================

  /**
   * Get paginated Material Rates with search and status filtering
   */
  async getMaterialRates(query: RateQueryInput) {
    const { page, limit, search, status, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;
    const now = new Date();

    const where: Prisma.MaterialRateWhereInput = {};

    if (search) {
      where.OR = [
        { materialCode: { contains: search, mode: 'insensitive' } },
        { materialName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status === 'CURRENT') {
      where.AND = [
        { validFrom: { lte: now } },
        {
          OR: [{ validTo: null }, { validTo: { gte: now } }],
        },
      ];
    } else if (status === 'EXPIRED') {
      where.AND = [{ validTo: { not: null } }, { validTo: { lt: now } }];
    } else if (status === 'UPCOMING') {
      where.validFrom = { gt: now };
    }

    const orderBy: Prisma.MaterialRateOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [total, rawRates] = await prisma.$transaction([
      prisma.materialRate.count({ where }),
      prisma.materialRate.findMany({
        where,
        skip,
        take: limit,
        orderBy,
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;
    const rates = rawRates.map((r) => this.formatMaterialRate(r));

    return {
      rates,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Return complete version history for a given materialCode
   */
  async getMaterialRateHistory(materialCode: string) {
    const rawRates = await prisma.materialRate.findMany({
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

    return rawRates.map((r) => this.formatMaterialRate(r));
  }

  /**
   * Create a new Material Rate version with overlap rejection
   */
  async createMaterialRate(input: CreateMaterialRateInput) {
    const validFrom = new Date(input.validFrom);
    const validTo = input.validTo ? new Date(input.validTo) : null;

    if (validTo && validTo.getTime() < validFrom.getTime()) {
      const error: AppError = new Error('Valid to date cannot be earlier than valid from date');
      error.statusCode = 400;
      throw error;
    }

    // Atomic transaction with overlap verification
    const createdRate = await prisma.$transaction(async (tx) => {
      // Check for overlapping date intervals for the same materialCode:
      // An overlap occurs if:
      // existing.validFrom <= (new.validTo ?? infinity) AND (existing.validTo ?? infinity) >= new.validFrom
      const overlapQuery: Prisma.MaterialRateWhereInput = {
        materialCode: {
          equals: input.materialCode.trim(),
          mode: 'insensitive',
        },
        AND: [
          // If validTo is specified, existing.validFrom must be <= validTo
          ...(validTo ? [{ validFrom: { lte: validTo } }] : []),
          // existing.validTo must be >= validFrom OR open-ended (null)
          {
            OR: [{ validTo: null }, { validTo: { gte: validFrom } }],
          },
        ],
      };

      const existingOverlap = await tx.materialRate.findFirst({
        where: overlapQuery,
      });

      if (existingOverlap) {
        const fromStr = new Date(existingOverlap.validFrom).toISOString().split('T')[0];
        const toStr = existingOverlap.validTo
          ? new Date(existingOverlap.validTo).toISOString().split('T')[0]
          : 'Indefinite';
        const error: AppError = new Error(
          `Date range overlaps with existing rate version for '${input.materialCode}' valid from ${fromStr} to ${toStr}`
        );
        error.statusCode = 400;
        throw error;
      }

      return tx.materialRate.create({
        data: {
          materialCode: input.materialCode.trim().toUpperCase(),
          materialName: input.materialName.trim(),
          ratePerKg: new Prisma.Decimal(input.ratePerKg),
          currency: input.currency || 'INR',
          validFrom,
          validTo,
        },
      });
    });

    return this.formatMaterialRate(createdRate);
  }

  /**
   * Controlled operation to close an existing Material Rate validity without changing historical price
   */
  async closeMaterialRate(id: string, input: CloseRateInput) {
    const validTo = new Date(input.validTo);

    const existing = await prisma.materialRate.findUnique({
      where: { id },
    });

    if (!existing) {
      const error: AppError = new Error(`Material rate with ID '${id}' not found`);
      error.statusCode = 404;
      throw error;
    }

    if (validTo.getTime() < new Date(existing.validFrom).getTime()) {
      const error: AppError = new Error(
        `End validity date (${validTo.toISOString().split('T')[0]}) cannot be earlier than rate valid from date (${new Date(existing.validFrom).toISOString().split('T')[0]})`
      );
      error.statusCode = 400;
      throw error;
    }

    const updated = await prisma.materialRate.update({
      where: { id },
      data: {
        validTo,
      },
    });

    return this.formatMaterialRate(updated);
  }

  // =========================================================================
  // MACHINE RATES
  // =========================================================================

  /**
   * Get paginated Machine Rates with search and status filtering
   */
  async getMachineRates(query: RateQueryInput) {
    const { page, limit, search, status, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;
    const now = new Date();

    const where: Prisma.MachineRateWhereInput = {};

    if (search) {
      where.OR = [
        { operationCode: { contains: search, mode: 'insensitive' } },
        { operationName: { contains: search, mode: 'insensitive' } },
        { machineName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status === 'CURRENT') {
      where.AND = [
        { validFrom: { lte: now } },
        {
          OR: [{ validTo: null }, { validTo: { gte: now } }],
        },
      ];
    } else if (status === 'EXPIRED') {
      where.AND = [{ validTo: { not: null } }, { validTo: { lt: now } }];
    } else if (status === 'UPCOMING') {
      where.validFrom = { gt: now };
    }

    const orderBy: Prisma.MachineRateOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [total, rawRates] = await prisma.$transaction([
      prisma.machineRate.count({ where }),
      prisma.machineRate.findMany({
        where,
        skip,
        take: limit,
        orderBy,
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;
    const rates = rawRates.map((r) => this.formatMachineRate(r));

    return {
      rates,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Return complete version history for a given operationCode
   */
  async getMachineRateHistory(operationCode: string) {
    const rawRates = await prisma.machineRate.findMany({
      where: {
        operationCode: {
          equals: operationCode.trim(),
          mode: 'insensitive',
        },
      },
      orderBy: {
        validFrom: 'desc',
      },
    });

    return rawRates.map((r) => this.formatMachineRate(r));
  }

  /**
   * Create a new Machine Rate version with overlap rejection
   */
  async createMachineRate(input: CreateMachineRateInput) {
    const validFrom = new Date(input.validFrom);
    const validTo = input.validTo ? new Date(input.validTo) : null;

    if (validTo && validTo.getTime() < validFrom.getTime()) {
      const error: AppError = new Error('Valid to date cannot be earlier than valid from date');
      error.statusCode = 400;
      throw error;
    }

    // Atomic transaction with overlap verification
    const createdRate = await prisma.$transaction(async (tx) => {
      const overlapQuery: Prisma.MachineRateWhereInput = {
        operationCode: {
          equals: input.operationCode.trim(),
          mode: 'insensitive',
        },
        AND: [
          ...(validTo ? [{ validFrom: { lte: validTo } }] : []),
          {
            OR: [{ validTo: null }, { validTo: { gte: validFrom } }],
          },
        ],
      };

      const existingOverlap = await tx.machineRate.findFirst({
        where: overlapQuery,
      });

      if (existingOverlap) {
        const fromStr = new Date(existingOverlap.validFrom).toISOString().split('T')[0];
        const toStr = existingOverlap.validTo
          ? new Date(existingOverlap.validTo).toISOString().split('T')[0]
          : 'Indefinite';
        const error: AppError = new Error(
          `Date range overlaps with existing machine rate version for '${input.operationCode}' valid from ${fromStr} to ${toStr}`
        );
        error.statusCode = 400;
        throw error;
      }

      return tx.machineRate.create({
        data: {
          operationCode: input.operationCode.trim().toUpperCase(),
          operationName: input.operationName.trim(),
          machineName: input.machineName.trim(),
          hourlyRate: new Prisma.Decimal(input.hourlyRate),
          currency: input.currency || 'INR',
          validFrom,
          validTo,
        },
      });
    });

    return this.formatMachineRate(createdRate);
  }

  /**
   * Controlled operation to close an existing Machine Rate validity without changing historical price
   */
  async closeMachineRate(id: string, input: CloseRateInput) {
    const validTo = new Date(input.validTo);

    const existing = await prisma.machineRate.findUnique({
      where: { id },
    });

    if (!existing) {
      const error: AppError = new Error(`Machine rate with ID '${id}' not found`);
      error.statusCode = 404;
      throw error;
    }

    if (validTo.getTime() < new Date(existing.validFrom).getTime()) {
      const error: AppError = new Error(
        `End validity date (${validTo.toISOString().split('T')[0]}) cannot be earlier than rate valid from date (${new Date(existing.validFrom).toISOString().split('T')[0]})`
      );
      error.statusCode = 400;
      throw error;
    }

    const updated = await prisma.machineRate.update({
      where: { id },
      data: {
        validTo,
      },
    });

    return this.formatMachineRate(updated);
  }
}

export const rateService = new RateService();

