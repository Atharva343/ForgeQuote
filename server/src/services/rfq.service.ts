import { Prisma, RfqStatus, UserRole } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import {
  CreateRfqInput,
  UpdateRfqInput,
  UpdateRfqStatusInput,
  RfqQueryInput,
} from '../validators/rfq.validator';

export class RfqService {
  /**
   * Generates a collision-free sequential RFQ number within a transaction.
   * Format: RFQ-YYMM-XXX (e.g., RFQ-2611-024)
   */
  private async generateRfqNumber(tx: Prisma.TransactionClient): Promise<string> {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `RFQ-${yy}${mm}-`;

    const existing = await tx.rfq.findMany({
      where: {
        rfqNumber: {
          startsWith: prefix,
        },
      },
      select: {
        rfqNumber: true,
      },
    });

    let maxSeq = 0;
    for (const item of existing) {
      const suffix = item.rfqNumber.slice(prefix.length);
      const parsed = parseInt(suffix, 10);
      if (!isNaN(parsed) && parsed > maxSeq) {
        maxSeq = parsed;
      }
    }

    const nextSeq = String(maxSeq + 1).padStart(3, '0');
    return `${prefix}${nextSeq}`;
  }

  /**
   * Helper to serialize Decimal and BigInt values safely for JSON responses.
   */
  private formatRfq(rfq: any) {
    if (!rfq) return rfq;
    return {
      ...rfq,
      parts: rfq.parts?.map((part: any) => ({
        ...part,
        grossWeightKg: part.grossWeightKg ? Number(part.grossWeightKg) : 0,
        routingOperations: part.routingOperations?.map((op: any) => ({
          ...op,
          setupTimeMinutes: op.setupTimeMinutes ? Number(op.setupTimeMinutes) : 0,
          cycleTimeMinutes: op.cycleTimeMinutes ? Number(op.cycleTimeMinutes) : 0,
        })),
      })),
      documents: rfq.documents?.map((doc: any) => ({
        ...doc,
        sizeBytes: doc.sizeBytes ? Number(doc.sizeBytes) : 0,
      })),
    };
  }

  /**
   * Retrieve paginated RFQ register with search and filtering.
   */
  async getRfqs(query: RfqQueryInput) {
    const { page, limit, search, status, customerId, ownerId, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.RfqWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (ownerId) {
      where.ownerId = ownerId;
    }

    if (search) {
      where.OR = [
        { rfqNumber: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { parts: { some: { partName: { contains: search, mode: 'insensitive' } } } },
        { parts: { some: { partNumber: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    const orderBy: Prisma.RfqOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [total, rawRfqs] = await prisma.$transaction([
      prisma.rfq.count({ where }),
      prisma.rfq.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              industry: true,
              contactEmail: true,
            },
          },
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          parts: {
            select: {
              id: true,
              partName: true,
              partNumber: true,
              drawingNumber: true,
              material: true,
              grossWeightKg: true,
              annualVolume: true,
              notes: true,
            },
            orderBy: {
              createdAt: 'asc',
            },
          },
          _count: {
            select: {
              parts: true,
              documents: true,
              quotations: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;
    const rfqs = rawRfqs.map((rfq) => this.formatRfq(rfq));

    return {
      rfqs,
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
   * Retrieve full RFQ details by ID.
   */
  async getRfqById(id: string) {
    const rawRfq = await prisma.rfq.findUnique({
      where: { id },
      include: {
        customer: true,
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        parts: {
          include: {
            routingOperations: {
              orderBy: {
                sequence: 'asc',
              },
            },
            quoteParts: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        documents: {
          include: {
            uploadedBy: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        quotations: {
          select: {
            id: true,
            quoteNumber: true,
            version: true,
            status: true,
            submittedAt: true,
            approvedAt: true,
            createdAt: true,
          },
          orderBy: {
            version: 'desc',
          },
        },
      },
    });

    if (!rawRfq) {
      const error: AppError = new Error(`RFQ with ID '${id}' not found`);
      error.statusCode = 404;
      throw error;
    }

    return this.formatRfq(rawRfq);
  }

  /**
   * Create new RFQ with multiple parts atomically.
   */
  async createRfq(userId: string, input: CreateRfqInput) {
    // 1. Validate customer existence
    const customer = await prisma.customer.findUnique({
      where: { id: input.customerId },
    });

    if (!customer) {
      const error: AppError = new Error(`Customer with ID '${input.customerId}' not found`);
      error.statusCode = 400;
      throw error;
    }

    // 2. Atomic creation inside transaction
    const createdRfq = await prisma.$transaction(async (tx) => {
      const rfqNumber = await this.generateRfqNumber(tx);

      return tx.rfq.create({
        data: {
          rfqNumber,
          customerId: input.customerId,
          title: input.title,
          description: input.description || null,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          ownerId: userId,
          status: RfqStatus.ESTIMATING,
          parts: {
            create: input.parts.map((p) => ({
              partName: p.partName,
              partNumber: p.partNumber || null,
              drawingNumber: p.drawingNumber || null,
              material: p.material,
              grossWeightKg: new Prisma.Decimal(p.grossWeightKg),
              annualVolume: p.annualVolume,
              notes: p.notes || null,
            })),
          },
        },
        include: {
          customer: true,
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          parts: true,
          _count: {
            select: {
              parts: true,
              documents: true,
              quotations: true,
            },
          },
        },
      });
    });

    return this.formatRfq(createdRfq);
  }

  /**
   * Update RFQ details and parts.
   */
  async updateRfq(id: string, _userId: string, _userRole: UserRole, input: UpdateRfqInput) {
    // 1. Verify existence
    const existing = await prisma.rfq.findUnique({
      where: { id },
      include: { parts: true },
    });

    if (!existing) {
      const error: AppError = new Error(`RFQ with ID '${id}' not found`);
      error.statusCode = 404;
      throw error;
    }

    // 2. Validate customer if updating customerId
    if (input.customerId && input.customerId !== existing.customerId) {
      const customer = await prisma.customer.findUnique({
        where: { id: input.customerId },
      });
      if (!customer) {
        const error: AppError = new Error(`Customer with ID '${input.customerId}' not found`);
        error.statusCode = 400;
        throw error;
      }
    }

    // 3. Update RFQ inside transaction
    const updated = await prisma.$transaction(async (tx) => {
      // Handle parts updating if provided
      if (input.parts && input.parts.length > 0) {
        for (const p of input.parts) {
          if (p.id) {
            // Update existing part
            await tx.rfqPart.update({
              where: { id: p.id },
              data: {
                partName: p.partName,
                partNumber: p.partNumber || null,
                drawingNumber: p.drawingNumber || null,
                material: p.material,
                grossWeightKg: new Prisma.Decimal(p.grossWeightKg),
                annualVolume: p.annualVolume,
                notes: p.notes || null,
              },
            });
          } else {
            // Create new part under this RFQ
            await tx.rfqPart.create({
              data: {
                rfqId: id,
                partName: p.partName,
                partNumber: p.partNumber || null,
                drawingNumber: p.drawingNumber || null,
                material: p.material,
                grossWeightKg: new Prisma.Decimal(p.grossWeightKg),
                annualVolume: p.annualVolume,
                notes: p.notes || null,
              },
            });
          }
        }
      }

      return tx.rfq.update({
        where: { id },
        data: {
          ...(input.title !== undefined && { title: input.title }),
          ...(input.customerId !== undefined && { customerId: input.customerId }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.dueDate !== undefined && {
            dueDate: input.dueDate ? new Date(input.dueDate) : null,
          }),
        },
        include: {
          customer: true,
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          parts: true,
          _count: {
            select: {
              parts: true,
              documents: true,
              quotations: true,
            },
          },
        },
      });
    });

    return this.formatRfq(updated);
  }

  /**
   * Update RFQ status with transition validation.
   */
  async updateRfqStatus(id: string, input: UpdateRfqStatusInput) {
    const existing = await prisma.rfq.findUnique({
      where: { id },
    });

    if (!existing) {
      const error: AppError = new Error(`RFQ with ID '${id}' not found`);
      error.statusCode = 404;
      throw error;
    }

    const isMovingToLost = input.status === RfqStatus.LOST;
    const lostReason = isMovingToLost ? input.lostReason?.trim() || null : null;

    if (isMovingToLost && (!lostReason || lostReason.length < 3)) {
      const error: AppError = new Error('A reason is required when marking an RFQ as LOST');
      error.statusCode = 400;
      throw error;
    }

    const updated = await prisma.rfq.update({
      where: { id },
      data: {
        status: input.status,
        lostReason,
      },
      include: {
        customer: true,
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        parts: true,
      },
    });

    return this.formatRfq(updated);
  }
}

export const rfqService = new RfqService();

