import { Prisma, QuotationStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { CostingInput } from '../validators/quotation.validator';
import { costingService } from './costing.service';

export class QuotationService {
  /**
   * Helper to format Decimal and Date values on quotations for clean JSON output
   */
  private formatQuotation(quote: any) {
    if (!quote) return quote;
    return {
      ...quote,
      pdf: quote.pdf
        ? {
            ...quote.pdf,
            sizeBytes: Number(quote.pdf.sizeBytes),
          }
        : null,
      quoteParts: quote.quoteParts?.map((qp: any) => ({
        ...qp,
        volumePrices: qp.volumePrices?.map((vp: any) => ({
          ...vp,
          materialCost: Number(vp.materialCost),
          processCost: Number(vp.processCost),
          scrapCost: Number(vp.scrapCost),
          overheadCost: Number(vp.overheadCost),
          freightCost: Number(vp.freightCost),
          totalCost: Number(vp.totalCost),
          marginPercentage: Number(vp.marginPercentage),
          sellingPricePerUnit: Number(vp.sellingPricePerUnit),
          annualValue: Number(vp.annualValue),
          gstPercentage: Number(vp.gstPercentage),
          gstAmount: Number(
            new Prisma.Decimal(vp.sellingPricePerUnit)
              .mul(vp.gstPercentage)
              .div(100)
              .toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP)
          ),
          sellingPriceWithGst: Number(
            new Prisma.Decimal(vp.sellingPricePerUnit)
              .mul(new Prisma.Decimal(1).add(new Prisma.Decimal(vp.gstPercentage).div(100)))
              .toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP)
          ),
        })),
      })),
    };
  }

  /**
   * Calculate costing preview without saving records
   */
  async previewQuotation(rfqId: string, input: CostingInput) {
    // 1. Verify RFQ exists
    const rfq = await prisma.rfq.findUnique({
      where: { id: rfqId },
      include: { customer: true },
    });

    if (!rfq) {
      const error: AppError = new Error(`RFQ with ID '${rfqId}' not found`);
      error.statusCode = 404;
      throw error;
    }

    // 2. Verify Part belongs to RFQ
    const part = await prisma.rfqPart.findFirst({
      where: {
        id: input.rfqPartId,
        rfqId,
      },
    });

    if (!part) {
      const error: AppError = new Error(
        `RFQ part with ID '${input.rfqPartId}' does not belong to RFQ '${rfq.rfqNumber}'`
      );
      error.statusCode = 400;
      throw error;
    }

    // 3. Compute Deterministic Costing
    const calculation = await costingService.calculateCosting(input.rfqPartId, input);

    return {
      rfq: {
        id: rfq.id,
        rfqNumber: rfq.rfqNumber,
        title: rfq.title,
        customerName: rfq.customer.name,
      },
      ...calculation,
    };
  }

  /**
   * Create DRAFT quotation with immutable rate snapshot and volume prices atomically
   */
  async createQuotation(rfqId: string, userId: string, input: CostingInput) {
    // 1. Verify RFQ exists
    const rfq = await prisma.rfq.findUnique({
      where: { id: rfqId },
      include: { customer: true },
    });

    if (!rfq) {
      const error: AppError = new Error(`RFQ with ID '${rfqId}' not found`);
      error.statusCode = 404;
      throw error;
    }

    // 2. Verify Part belongs to RFQ
    const part = await prisma.rfqPart.findFirst({
      where: {
        id: input.rfqPartId,
        rfqId,
      },
    });

    if (!part) {
      const error: AppError = new Error(
        `RFQ part with ID '${input.rfqPartId}' does not belong to RFQ '${rfq.rfqNumber}'`
      );
      error.statusCode = 400;
      throw error;
    }

    // 3. Re-calculate costing deterministically on backend (never trust client)
    const calculation = await costingService.calculateCosting(input.rfqPartId, input);

    // 4. Atomic transaction to create quotation, snapshot, and volume tiers
    const createdQuotation = await prisma.$transaction(
      async (tx) => {
        // Determine next version number for this RFQ
        const maxVersionAgg = await tx.quotation.aggregate({
          where: { rfqId },
          _max: { version: true },
        });
        const version = (maxVersionAgg._max.version || 0) + 1;

        // Unique quote number e.g. Q-2611-014-V1
        const rfqCode = rfq.rfqNumber.replace(/^RFQ-/, '');
        const quoteNumber = `Q-${rfqCode}-V${version}`;

        // Create Quotation, QuotePart, and QuoteVolumePrice atomically in a single nested create
        return tx.quotation.create({
          data: {
            quoteNumber,
            rfqId,
            version,
            status: QuotationStatus.DRAFT,
            createdById: userId,
            quoteParts: {
              create: {
                rfqPartId: part.id,
                rateSnapshot: calculation.rateSnapshot,
                costBreakdown: {
                  ...calculation.costBreakdown,
                  partMetadata: calculation.rfqPart,
                },
                volumePrices: {
                  create: calculation.scenarios.map((scenario) => ({
                    productionVolume: scenario.productionVolume,
                    materialCost: new Prisma.Decimal(scenario.materialCost),
                    processCost: new Prisma.Decimal(scenario.processCost),
                    scrapCost: new Prisma.Decimal(scenario.scrapCost),
                    overheadCost: new Prisma.Decimal(scenario.overheadCost),
                    freightCost: new Prisma.Decimal(scenario.freightCost),
                    totalCost: new Prisma.Decimal(scenario.totalCost),
                    marginPercentage: new Prisma.Decimal(scenario.marginPercentage),
                    sellingPricePerUnit: new Prisma.Decimal(scenario.sellingPriceBeforeGst),
                    annualValue: new Prisma.Decimal(scenario.annualValue),
                    gstPercentage: new Prisma.Decimal(scenario.gstPercentage),
                  })),
                },
              },
            },
          },
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
        });
      },
      {
        timeout: 30000,
        maxWait: 15000,
      }
    );

    return this.formatQuotation(createdQuotation);
  }

  /**
   * Retrieve all quotations associated with an RFQ
   */
  async getQuotationsByRfq(rfqId: string) {
    const rawQuotes = await prisma.quotation.findMany({
      where: { rfqId },
      include: {
        pdf: true,
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
      orderBy: { version: 'desc' },
    });

    return rawQuotes.map((q) => this.formatQuotation(q));
  }

  /**
   * Retrieve single quotation by ID
   */
  async getQuotationById(id: string) {
    const rawQuote = await prisma.quotation.findUnique({
      where: { id },
      include: {
        pdf: true,
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
    });

    if (!rawQuote) {
      const error: AppError = new Error(`Quotation with ID '${id}' not found`);
      error.statusCode = 404;
      throw error;
    }

    return this.formatQuotation(rawQuote);
  }
}

export const quotationService = new QuotationService();
