import { Prisma, QuotationStatus, QuoteApprovalStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { quotationService } from './quotation.service';
import { ApprovalQueueQueryInput } from '../validators/approval.validator';

/**
 * Commercial Approval Policy Configuration:
 * Threshold is ₹25,00,000 (Twenty-Five Lakh INR) pre-GST annual quotation value.
 */
export const APPROVAL_THRESHOLD_INR = new Prisma.Decimal(2500000);

export interface EvaluatedQuotationValue {
  highestAnnualPreGstValue: Prisma.Decimal;
  scenarioAnnualValues: Prisma.Decimal[];
  requiresApproval: boolean;
  thresholdInr: Prisma.Decimal;
}

export class ApprovalService {
  /**
   * EXACT THRESHOLD AGGREGATION CONVENTION:
   * 1. Multi-Part Aggregation:
   *    For a quotation with multiple parts, each part's volumePrices array is ordered
   *    by productionVolume ascending (representing corresponding batch volume scenarios).
   * 2. Scenario-Level Annual Value:
   *    For each scenario index i (0, 1, 2, ...):
   *    ScenarioTotal[i] = Sum of (part.volumePrices[i].annualValue) across all parts in the quotation.
   * 3. Quotation-Level Evaluated Value:
   *    HighestAnnualPreGstValue = Max(ScenarioTotal[i]) across all volume scenarios.
   * 4. Pre-GST Threshold Comparison:
   *    - Strictly excludes GST (calculated solely from sellingPriceBeforeGst * part.annualVolume).
   *    - If HighestAnnualPreGstValue > ₹25,00,000 INR -> Requires Sales Head approval (PENDING_APPROVAL).
   *    - If HighestAnnualPreGstValue <= ₹25,00,000 INR -> Auto-approved on submission (APPROVED).
   */
  public evaluateQuotationAnnualValue(quoteParts: any[]): EvaluatedQuotationValue {
    if (!quoteParts || quoteParts.length === 0) {
      return {
        highestAnnualPreGstValue: new Prisma.Decimal(0),
        scenarioAnnualValues: [],
        requiresApproval: false,
        thresholdInr: APPROVAL_THRESHOLD_INR,
      };
    }

    // Determine the maximum number of volume scenarios across all quote parts
    let maxScenarios = 0;
    for (const qp of quoteParts) {
      if (qp.volumePrices && qp.volumePrices.length > maxScenarios) {
        maxScenarios = qp.volumePrices.length;
      }
    }

    if (maxScenarios === 0) {
      return {
        highestAnnualPreGstValue: new Prisma.Decimal(0),
        scenarioAnnualValues: [],
        requiresApproval: false,
        thresholdInr: APPROVAL_THRESHOLD_INR,
      };
    }

    const scenarioAnnualValues: Prisma.Decimal[] = [];
    let highestAnnualPreGstValue = new Prisma.Decimal(0);

    for (let i = 0; i < maxScenarios; i++) {
      let scenarioSum = new Prisma.Decimal(0);

      for (const qp of quoteParts) {
        // Sort volume prices by production volume to align scenario indices consistently
        const sortedVps = [...(qp.volumePrices || [])].sort(
          (a, b) => a.productionVolume - b.productionVolume
        );

        if (sortedVps[i]) {
          const vpAnnualVal = new Prisma.Decimal(sortedVps[i].annualValue);
          scenarioSum = scenarioSum.add(vpAnnualVal);
        }
      }

      scenarioAnnualValues.push(scenarioSum);
      if (scenarioSum.greaterThan(highestAnnualPreGstValue)) {
        highestAnnualPreGstValue = scenarioSum;
      }
    }

    // Exactly 25 Lakh (<= 25,00,000) does NOT require approval.
    // Strictly greater than 25 Lakh (> 25,00,000) requires Sales Head approval.
    const requiresApproval = highestAnnualPreGstValue.greaterThan(APPROVAL_THRESHOLD_INR);

    return {
      highestAnnualPreGstValue,
      scenarioAnnualValues,
      requiresApproval,
      thresholdInr: APPROVAL_THRESHOLD_INR,
    };
  }

  /**
   * Submit a DRAFT quotation for commercial approval or auto-approval
   */
  async submitQuotation(quotationId: string, estimatorId: string, comments?: string) {
    // 1. Fetch quotation with parts and volume prices
    const quotation = await prisma.quotation.findUnique({
      where: { id: quotationId },
      include: {
        quoteParts: {
          include: {
            volumePrices: {
              orderBy: { productionVolume: 'asc' },
            },
          },
        },
      },
    });

    if (!quotation) {
      const error: AppError = new Error(`Quotation with ID '${quotationId}' not found`);
      error.statusCode = 404;
      throw error;
    }

    // 2. Validate current status is DRAFT
    if (quotation.status !== QuotationStatus.DRAFT) {
      const error: AppError = new Error(
        `Quotation is in '${quotation.status}' status and cannot be submitted. Only DRAFT quotations can be submitted.`
      );
      error.statusCode = 400;
      throw error;
    }

    // 3. Verify costing data exists
    if (!quotation.quoteParts || quotation.quoteParts.length === 0) {
      const error: AppError = new Error('Quotation has no parts and cannot be submitted.');
      error.statusCode = 400;
      throw error;
    }

    for (const qp of quotation.quoteParts) {
      if (!qp.volumePrices || qp.volumePrices.length === 0) {
        const error: AppError = new Error('Quotation contains parts without saved volume pricing.');
        error.statusCode = 400;
        throw error;
      }
    }

    // 4. Compute pre-GST annual value and determine approval requirement
    const evaluated = this.evaluateQuotationAnnualValue(quotation.quoteParts);
    const targetStatus = evaluated.requiresApproval
      ? QuotationStatus.PENDING_APPROVAL
      : QuotationStatus.APPROVED;

    const submissionTime = new Date();

    // 5. Execute atomic transition with optimistic check
    await prisma.$transaction(
      async (tx) => {
        // Conditional update ensures concurrency protection
        const updateResult = await tx.quotation.updateMany({
          where: {
            id: quotationId,
            status: QuotationStatus.DRAFT,
          },
          data: {
            status: targetStatus,
            submittedAt: submissionTime,
            approvedAt: targetStatus === QuotationStatus.APPROVED ? submissionTime : null,
          },
        });

        if (updateResult.count === 0) {
          const error: AppError = new Error(
            'Quotation status changed concurrently or is no longer in DRAFT status.'
          );
          error.statusCode = 409;
          throw error;
        }

        // Create QuoteApproval record
        await tx.quoteApproval.create({
          data: {
            quotationId,
            reviewerId: estimatorId,
            status:
              targetStatus === QuotationStatus.APPROVED
                ? QuoteApprovalStatus.APPROVED
                : QuoteApprovalStatus.PENDING,
            reviewedAt: targetStatus === QuotationStatus.APPROVED ? submissionTime : null,
            comments:
              targetStatus === QuotationStatus.APPROVED
                ? comments ||
                  `Auto-approved on submission: pre-GST annual value (₹${evaluated.highestAnnualPreGstValue.toFixed(
                    2
                  )}) is <= ₹25,00,000 threshold. Sales Head approval not required.`
                : comments ||
                  `Submitted for Sales Head approval: pre-GST annual value (₹${evaluated.highestAnnualPreGstValue.toFixed(
                    2
                  )}) exceeds ₹25,00,000 threshold.`,
          },
        });

        // Create AuditLog record
        await tx.auditLog.create({
          data: {
            actorId: estimatorId,
            entityType: 'QUOTATION',
            entityId: quotationId,
            action:
              targetStatus === QuotationStatus.APPROVED
                ? 'QUOTATION_AUTO_APPROVED'
                : 'QUOTATION_SUBMITTED',
            details: {
              decision:
                targetStatus === QuotationStatus.APPROVED ? 'AUTO_APPROVED' : 'SUBMITTED',
              requiresApproval: evaluated.requiresApproval,
              thresholdValue: evaluated.thresholdInr.toNumber(),
              evaluatedAnnualValue: evaluated.highestAnnualPreGstValue.toNumber(),
              comments: comments || null,
              submittedAt: submissionTime.toISOString(),
            },
          },
        });
      },
      { timeout: 30000, maxWait: 15000 }
    );

    // 6. Fetch updated formatted quotation
    const updatedQuotation = await quotationService.getQuotationById(quotationId);

    return {
      quotation: updatedQuotation,
      requiresApproval: evaluated.requiresApproval,
      evaluatedAnnualValue: evaluated.highestAnnualPreGstValue.toNumber(),
      thresholdValue: evaluated.thresholdInr.toNumber(),
    };
  }

  /**
   * Retrieve the Sales Head approval queue (all PENDING_APPROVAL quotations)
   */
  async getApprovalQueue(params: ApprovalQueueQueryInput) {
    const { page, limit, search } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.QuotationWhereInput = {
      status: QuotationStatus.PENDING_APPROVAL,
    };

    if (search && search.trim() !== '') {
      const term = search.trim();
      where.OR = [
        { quoteNumber: { contains: term, mode: 'insensitive' } },
        { rfq: { rfqNumber: { contains: term, mode: 'insensitive' } } },
        { rfq: { title: { contains: term, mode: 'insensitive' } } },
        { rfq: { customer: { name: { contains: term, mode: 'insensitive' } } } },
        { createdBy: { name: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const [total, rawQuotes] = await Promise.all([
      prisma.quotation.count({ where }),
      prisma.quotation.findMany({
        where,
        include: {
          rfq: {
            include: { customer: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true, role: true },
          },
          quoteParts: {
            include: {
              rfqPart: true,
              volumePrices: {
                orderBy: { productionVolume: 'asc' },
              },
            },
          },
        },
        orderBy: { submittedAt: 'asc' }, // Oldest pending first
        skip,
        take: limit,
      }),
    ]);

    const queueItems = rawQuotes.map((q) => {
      const evaluated = this.evaluateQuotationAnnualValue(q.quoteParts);
      const formatted = (quotationService as any).formatQuotation(q);

      return {
        ...formatted,
        highestAnnualPreGstValue: evaluated.highestAnnualPreGstValue.toNumber(),
        requiresApproval: evaluated.requiresApproval,
        thresholdValue: evaluated.thresholdInr.toNumber(),
      };
    });

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items: queueItems,
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
   * Approve a PENDING_APPROVAL quotation by SALES_HEAD
   */
  async approveQuotation(quotationId: string, salesHeadId: string, comments?: string) {
    // 1. Fetch quotation
    const quotation = await prisma.quotation.findUnique({
      where: { id: quotationId },
      include: {
        quoteParts: {
          include: {
            volumePrices: {
              orderBy: { productionVolume: 'asc' },
            },
          },
        },
      },
    });

    if (!quotation) {
      const error: AppError = new Error(`Quotation with ID '${quotationId}' not found`);
      error.statusCode = 404;
      throw error;
    }

    // 2. Validate current status
    if (quotation.status !== QuotationStatus.PENDING_APPROVAL) {
      const error: AppError = new Error(
        `Quotation is not pending approval (current status: '${quotation.status}'). Only PENDING_APPROVAL quotations can be approved.`
      );
      error.statusCode = 400;
      throw error;
    }

    // 3. Re-evaluate threshold from persisted data
    const evaluated = this.evaluateQuotationAnnualValue(quotation.quoteParts);
    const approvedAt = new Date();

    let createdApproval: any;

    // 4. Atomic conditional update
    await prisma.$transaction(
      async (tx) => {
        const updateResult = await tx.quotation.updateMany({
          where: {
            id: quotationId,
            status: QuotationStatus.PENDING_APPROVAL,
          },
          data: {
            status: QuotationStatus.APPROVED,
            approvedAt,
          },
        });

        if (updateResult.count === 0) {
          const error: AppError = new Error(
            'Quotation is no longer pending approval or has already been decided.'
          );
          error.statusCode = 409;
          throw error;
        }

        // Record QuoteApproval
        createdApproval = await tx.quoteApproval.create({
          data: {
            quotationId,
            reviewerId: salesHeadId,
            status: QuoteApprovalStatus.APPROVED,
            reviewedAt: approvedAt,
            comments: comments || 'Approved by Sales Head.',
          },
        });

        // Record AuditLog
        await tx.auditLog.create({
          data: {
            actorId: salesHeadId,
            entityType: 'QUOTATION',
            entityId: quotationId,
            action: 'QUOTATION_APPROVED',
            details: {
              decision: 'APPROVED',
              requiresApproval: true,
              thresholdValue: evaluated.thresholdInr.toNumber(),
              evaluatedAnnualValue: evaluated.highestAnnualPreGstValue.toNumber(),
              comments: comments || null,
              approvedAt: approvedAt.toISOString(),
            },
          },
        });
      },
      { timeout: 30000, maxWait: 15000 }
    );

    const updatedQuotation = await quotationService.getQuotationById(quotationId);

    return {
      quotation: updatedQuotation,
      approval: createdApproval,
    };
  }

  /**
   * Reject a PENDING_APPROVAL quotation by SALES_HEAD
   */
  async rejectQuotation(quotationId: string, salesHeadId: string, reason: string) {
    if (!reason || reason.trim().length === 0) {
      const error: AppError = new Error('Rejection reason is required.');
      error.statusCode = 400;
      throw error;
    }

    // 1. Fetch quotation
    const quotation = await prisma.quotation.findUnique({
      where: { id: quotationId },
      include: {
        quoteParts: {
          include: {
            volumePrices: {
              orderBy: { productionVolume: 'asc' },
            },
          },
        },
      },
    });

    if (!quotation) {
      const error: AppError = new Error(`Quotation with ID '${quotationId}' not found`);
      error.statusCode = 404;
      throw error;
    }

    // 2. Validate current status
    if (quotation.status !== QuotationStatus.PENDING_APPROVAL) {
      const error: AppError = new Error(
        `Quotation is not pending approval (current status: '${quotation.status}'). Only PENDING_APPROVAL quotations can be rejected.`
      );
      error.statusCode = 400;
      throw error;
    }

    const evaluated = this.evaluateQuotationAnnualValue(quotation.quoteParts);
    const rejectedAt = new Date();

    let createdApproval: any;

    // 3. Atomic conditional update
    await prisma.$transaction(
      async (tx) => {
        const updateResult = await tx.quotation.updateMany({
          where: {
            id: quotationId,
            status: QuotationStatus.PENDING_APPROVAL,
          },
          data: {
            status: QuotationStatus.REJECTED,
          },
        });

        if (updateResult.count === 0) {
          const error: AppError = new Error(
            'Quotation is no longer pending approval or has already been decided.'
          );
          error.statusCode = 409;
          throw error;
        }

        // Record QuoteApproval
        createdApproval = await tx.quoteApproval.create({
          data: {
            quotationId,
            reviewerId: salesHeadId,
            status: QuoteApprovalStatus.REJECTED,
            reviewedAt: rejectedAt,
            comments: reason.trim(),
          },
        });

        // Record AuditLog
        await tx.auditLog.create({
          data: {
            actorId: salesHeadId,
            entityType: 'QUOTATION',
            entityId: quotationId,
            action: 'QUOTATION_REJECTED',
            details: {
              decision: 'REJECTED',
              requiresApproval: true,
              rejectionReason: reason.trim(),
              thresholdValue: evaluated.thresholdInr.toNumber(),
              evaluatedAnnualValue: evaluated.highestAnnualPreGstValue.toNumber(),
              rejectedAt: rejectedAt.toISOString(),
            },
          },
        });
      },
      { timeout: 30000, maxWait: 15000 }
    );

    const updatedQuotation = await quotationService.getQuotationById(quotationId);

    return {
      quotation: updatedQuotation,
      approval: createdApproval,
    };
  }

  /**
   * Retrieve complete approval and submission audit history for a quotation
   */
  async getApprovalHistory(quotationId: string) {
    // 1. Verify quotation exists
    const quotation = await prisma.quotation.findUnique({
      where: { id: quotationId },
      select: { id: true, quoteNumber: true, status: true },
    });

    if (!quotation) {
      const error: AppError = new Error(`Quotation with ID '${quotationId}' not found`);
      error.statusCode = 404;
      throw error;
    }

    // 2. Fetch all audit logs for this quotation
    const logs = await prisma.auditLog.findMany({
      where: {
        entityType: 'QUOTATION',
        entityId: quotationId,
      },
      include: {
        actor: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const history = logs.map((log) => {
      const details = (log.details as Record<string, any>) || {};
      return {
        id: log.id,
        decision: details.decision || log.action,
        action: log.action,
        actor: log.actor
          ? {
              id: log.actor.id,
              name: log.actor.name,
              email: log.actor.email,
              role: log.actor.role,
            }
          : null,
        role: log.actor?.role || 'SYSTEM',
        timestamp: log.createdAt,
        rejectionReason: details.rejectionReason || null,
        requiresApproval: details.requiresApproval ?? true,
        thresholdValue: details.thresholdValue ?? APPROVAL_THRESHOLD_INR.toNumber(),
        evaluatedAnnualValue: details.evaluatedAnnualValue ?? null,
        comments: details.comments || null,
      };
    });

    return { history };
  }
}

export const approvalService = new ApprovalService();
