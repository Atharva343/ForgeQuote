import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma } from '../config/prisma';
import { QuotationStatus, UserRole, RfqStatus, Prisma } from '@prisma/client';
import { quotationPdfService } from '../services/quotation-pdf.service';
import { getSellerProfile } from '../config/seller.config';

describe('Professional PDF Quotation Generation Suite (/api/quotations/:id/pdf)', () => {
  let estimatorCookie: string[] = [];
  let salesHeadCookie: string[] = [];
  let estimatorUser: any;
  let salesHeadUser: any;

  let testCustomerId: string;
  let testRfqId: string;
  let testPartId: string;

  let approvedQuoteId: string;
  let autoApprovedQuoteId: string;
  let draftQuoteId: string;
  let pendingQuoteId: string;
  let rejectedQuoteId: string;

  let quoteVersion = 1;

  async function createTestQuotation(status: QuotationStatus, annualValue: number) {
    const v = quoteVersion++;
    const quoteNumber = `Q-TEST-PDF-${v}-${Date.now()}`;

    return await prisma.quotation.create({
      data: {
        quoteNumber,
        rfqId: testRfqId,
        version: v,
        status,
        createdById: estimatorUser.id,
        submittedAt: status !== QuotationStatus.DRAFT ? new Date() : null,
        approvedAt: status === QuotationStatus.APPROVED ? new Date() : null,
        quoteParts: {
          create: {
            rfqPartId: testPartId,
            rateSnapshot: {
              material: { code: 'MAT-AL-6061', rate: 320.5 },
              routing: [{ code: 'CNC-MILL-4AXIS', rate: 1200 }],
            },
            costBreakdown: {
              scrapPercentage: 5,
              overheadPercentage: 10,
              marginPercentage: 15,
            },
            volumePrices: {
              create: [
                {
                  productionVolume: 1000,
                  materialCost: new Prisma.Decimal('150.2500'),
                  processCost: new Prisma.Decimal('120.0000'),
                  scrapCost: new Prisma.Decimal('7.5000'),
                  overheadCost: new Prisma.Decimal('27.0250'),
                  freightCost: new Prisma.Decimal('5.0000'),
                  totalCost: new Prisma.Decimal('309.7750'),
                  marginPercentage: new Prisma.Decimal('15.00'),
                  sellingPricePerUnit: new Prisma.Decimal('364.4412'),
                  annualValue: new Prisma.Decimal(annualValue.toString()),
                  gstPercentage: new Prisma.Decimal('18.00'),
                },
                {
                  productionVolume: 5000,
                  materialCost: new Prisma.Decimal('145.0000'),
                  processCost: new Prisma.Decimal('105.0000'),
                  scrapCost: new Prisma.Decimal('7.2500'),
                  overheadCost: new Prisma.Decimal('25.0000'),
                  freightCost: new Prisma.Decimal('4.5000'),
                  totalCost: new Prisma.Decimal('286.7500'),
                  marginPercentage: new Prisma.Decimal('15.00'),
                  sellingPricePerUnit: new Prisma.Decimal('337.3529'),
                  annualValue: new Prisma.Decimal((annualValue * 4.5).toString()),
                  gstPercentage: new Prisma.Decimal('18.00'),
                },
              ],
            },
          },
        },
      },
      include: {
        quoteParts: { include: { volumePrices: true } },
      },
    });
  }

  beforeAll(async () => {
    // 1. Authenticate users
    const estimatorLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'estimator@forgequote.io',
        password: process.env.SEED_ESTIMATOR_PASSWORD || 'ForgeQuote@2026',
      });
    expect(estimatorLogin.status).toBe(200);
    estimatorCookie = estimatorLogin.headers['set-cookie'] || [];
    estimatorUser = estimatorLogin.body.data.user;

    const salesHeadLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'saleshead@forgequote.io',
        password: process.env.SEED_SALES_HEAD_PASSWORD || 'ForgeQuote@2026',
      });
    expect(salesHeadLogin.status).toBe(200);
    salesHeadCookie = salesHeadLogin.headers['set-cookie'] || [];
    salesHeadUser = salesHeadLogin.body.data.user;

    // 2. Setup isolated customer, RFQ, and part with routing
    const customer = await prisma.customer.create({
      data: {
        name: `Test PDF Aerospace Ltd ${Date.now()}`,
        industry: 'Defense & Aerospace Precision',
        contactEmail: 'procurement@testaerospace.example.com',
      },
    });
    testCustomerId = customer.id;

    const rfq = await prisma.rfq.create({
      data: {
        rfqNumber: `RFQ-TEST-PDF-${Date.now()}`,
        title: 'Precision Missile Flange Assembly',
        customerId: testCustomerId,
        status: RfqStatus.ESTIMATING,
      },
    });
    testRfqId = rfq.id;

    const part = await prisma.rfqPart.create({
      data: {
        rfqId: testRfqId,
        partName: 'Titanium Rotor Flange',
        partNumber: 'TRF-9021',
        material: 'MAT-AL-6061',
        grossWeightKg: new Prisma.Decimal('3.2500'),
        annualVolume: 5000,
        drawingNumber: 'DWG-TRF-001-REV-C',
      },
    });
    testPartId = part.id;

    await prisma.routingOperation.createMany({
      data: [
        {
          partId: testPartId,
          sequence: 1,
          operationName: 'Rough Facing & Turning',
          machineCode: 'CNC-LATHE-01',
          cycleTimeMinutes: new Prisma.Decimal('4.50'),
          setupTimeMinutes: new Prisma.Decimal('30.00'),
        },
        {
          partId: testPartId,
          sequence: 2,
          operationName: '4-Axis Precision Milling',
          machineCode: 'CNC-MILL-4AXIS',
          cycleTimeMinutes: new Prisma.Decimal('8.20'),
          setupTimeMinutes: new Prisma.Decimal('45.00'),
        },
      ],
    });

    // 3. Create quotations in different states
    const draftQ = await createTestQuotation(QuotationStatus.DRAFT, 1200000);
    draftQuoteId = draftQ.id;

    const pendingQ = await createTestQuotation(QuotationStatus.PENDING_APPROVAL, 3500000);
    pendingQuoteId = pendingQ.id;

    const rejectedQ = await createTestQuotation(QuotationStatus.REJECTED, 4000000);
    rejectedQuoteId = rejectedQ.id;

    const autoApprQ = await createTestQuotation(QuotationStatus.APPROVED, 1800000);
    autoApprovedQuoteId = autoApprQ.id;

    const salesApprQ = await createTestQuotation(QuotationStatus.APPROVED, 5000000);
    approvedQuoteId = salesApprQ.id;
  });

  afterAll(async () => {
    // Clean up test data
    if (testRfqId) {
      const quotes = await prisma.quotation.findMany({
        where: { rfqId: testRfqId },
        select: { id: true },
      });
      const qIds = quotes.map((q) => q.id);

      if (qIds.length > 0) {
        await prisma.quotationPdf.deleteMany({ where: { quotationId: { in: qIds } } });
        await prisma.quoteApproval.deleteMany({ where: { quotationId: { in: qIds } } });
        await prisma.quoteVolumePrice.deleteMany({
          where: { quotePart: { quotationId: { in: qIds } } },
        });
        await prisma.quotePart.deleteMany({ where: { quotationId: { in: qIds } } });
        await prisma.quotation.deleteMany({ where: { id: { in: qIds } } });
      }

      await prisma.routingOperation.deleteMany({ where: { partId: testPartId } });
      await prisma.rfqPart.deleteMany({ where: { rfqId: testRfqId } });
      await prisma.rfq.deleteMany({ where: { id: testRfqId } });
      await prisma.customer.deleteMany({ where: { id: testCustomerId } });
    }
  });

  // 1. DRAFT quotation cannot generate PDF
  it('1. DRAFT quotation is rejected for PDF generation with HTTP 409', async () => {
    const res = await request(app)
      .post(`/api/quotations/${draftQuoteId}/pdf`)
      .set('Cookie', estimatorCookie);

    expect(res.status).toBe(409);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toContain('APPROVED');
  });

  // 2. PENDING_APPROVAL quotation cannot generate PDF
  it('2. PENDING_APPROVAL quotation is rejected for PDF generation with HTTP 409', async () => {
    const res = await request(app)
      .post(`/api/quotations/${pendingQuoteId}/pdf`)
      .set('Cookie', salesHeadCookie);

    expect(res.status).toBe(409);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toContain('APPROVED');
  });

  // 3. REJECTED quotation cannot generate PDF
  it('3. REJECTED quotation is rejected for PDF generation with HTTP 409', async () => {
    const res = await request(app)
      .post(`/api/quotations/${rejectedQuoteId}/pdf`)
      .set('Cookie', estimatorCookie);

    expect(res.status).toBe(409);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toContain('APPROVED');
  });

  // 4. APPROVED quotation generates PDF successfully (HTTP 201)
  it('4. APPROVED quotation generates professional PDF and stores in private storage (HTTP 201)', async () => {
    const res = await request(app)
      .post(`/api/quotations/${approvedQuoteId}/pdf`)
      .set('Cookie', estimatorCookie);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data.quotationId).toBe(approvedQuoteId);
    expect(res.body.data.fileName).toMatch(/\.pdf$/);
    expect(res.body.data.sizeBytes).toBeGreaterThan(1000); // Non-empty valid PDF
    expect(res.body.data.checksumSha256).toBeTruthy();
    expect(res.body.data.storagePath).toContain(`quotations/${approvedQuoteId}/`);
    expect(res.body.data.isExisting).toBe(false);

    // Verify persisted in PostgreSQL
    const pdfInDb = await prisma.quotationPdf.findUnique({
      where: { quotationId: approvedQuoteId },
    });
    expect(pdfInDb).toBeTruthy();
    expect(pdfInDb?.fileName).toBe(res.body.data.fileName);
    expect(Number(pdfInDb?.sizeBytes)).toBe(res.body.data.sizeBytes);
  });

  // 5. Idempotent PDF generation returns existing artifact without duplicate creation
  it('5. Subsequent PDF request returns existing artifact idempotently (HTTP 200)', async () => {
    const res = await request(app)
      .post(`/api/quotations/${approvedQuoteId}/pdf`)
      .set('Cookie', salesHeadCookie);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.isExisting).toBe(true);
    expect(res.body.data.quotationId).toBe(approvedQuoteId);

    // Verify no duplicate records created
    const count = await prisma.quotationPdf.count({
      where: { quotationId: approvedQuoteId },
    });
    expect(count).toBe(1);
  });

  // 6. Automatically approved quotation can also generate PDF
  it('6. Automatically approved quotation can generate PDF successfully', async () => {
    const res = await request(app)
      .post(`/api/quotations/${autoApprovedQuoteId}/pdf`)
      .set('Cookie', estimatorCookie);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data.quotationId).toBe(autoApprovedQuoteId);
  });

  // 7. Audit log is created for PDF generation event
  it('7. AuditLog records the PDF generation event with actor and file metadata', async () => {
    const audit = await prisma.auditLog.findFirst({
      where: {
        entityType: 'QUOTATION',
        entityId: approvedQuoteId,
        action: 'PDF_GENERATED',
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(audit).toBeTruthy();
    expect(audit?.actorId).toBe(estimatorUser.id);
    const details = audit?.details as any;
    expect(details.fileName).toMatch(/\.pdf$/);
    expect(details.sizeBytes).toBeGreaterThan(1000);
    expect(details.checksumSha256).toBeTruthy();
  });

  // 8. Saved rate snapshots and quotation data remain immutable after PDF generation
  it('8. Rate snapshots, volume pricing, and quotation status remain unchanged after PDF generation', async () => {
    const quote = await prisma.quotation.findUnique({
      where: { id: approvedQuoteId },
      include: {
        quoteParts: {
          include: { volumePrices: true },
        },
      },
    });

    expect(quote?.status).toBe(QuotationStatus.APPROVED);
    expect(quote?.quoteParts[0].rateSnapshot).toEqual({
      material: { code: 'MAT-AL-6061', rate: 320.5 },
      routing: [{ code: 'CNC-MILL-4AXIS', rate: 1200 }],
    });
    expect(quote?.quoteParts[0].volumePrices.length).toBe(2);
  });

  // 9. Authenticated GET returns signed download URL and metadata
  it('9. GET /api/quotations/:id/pdf returns secure signed download URL and metadata', async () => {
    const res = await request(app)
      .get(`/api/quotations/${approvedQuoteId}/pdf`)
      .set('Cookie', estimatorCookie);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.pdfRecord.quotationId).toBe(approvedQuoteId);
    expect(res.body.data.pdfRecord.fileName).toMatch(/\.pdf$/);
    expect(res.body.data.downloadUrl).toBeTruthy();
    expect(res.body.data.expiresInSeconds).toBe(60);
  });

  // 10. GET with stream=true streams valid binary PDF content
  it('10. GET /api/quotations/:id/pdf?stream=true streams binary PDF with %PDF- header', async () => {
    const res = await request(app)
      .get(`/api/quotations/${approvedQuoteId}/pdf?stream=true`)
      .set('Cookie', salesHeadCookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain('.pdf');

    // PDF files start with the magic byte sequence %PDF-
    const isPdfHeader = res.body.slice(0, 5).toString('ascii') === '%PDF-';
    expect(isPdfHeader).toBe(true);
  });

  // 11. Unauthenticated requests to PDF endpoints return HTTP 401
  it('11. Unauthenticated requests return HTTP 401 Unauthorized', async () => {
    const postRes = await request(app).post(`/api/quotations/${approvedQuoteId}/pdf`);
    expect(postRes.status).toBe(401);

    const getRes = await request(app).get(`/api/quotations/${approvedQuoteId}/pdf`);
    expect(getRes.status).toBe(401);
  });

  // 12. GET for non-existent quotation returns HTTP 404
  it('12. GET for non-existent quotation returns HTTP 404', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app)
      .get(`/api/quotations/${fakeId}/pdf`)
      .set('Cookie', estimatorCookie);

    expect(res.status).toBe(404);
  });

  // 13. GET for quotation without generated PDF returns HTTP 404
  it('13. GET for quotation without generated PDF returns HTTP 404', async () => {
    const ungeneratedQ = await createTestQuotation(QuotationStatus.APPROVED, 1500000);
    const res = await request(app)
      .get(`/api/quotations/${ungeneratedQ.id}/pdf`)
      .set('Cookie', salesHeadCookie);

    expect(res.status).toBe(404);
    expect(res.body.message).toContain('not found');
  });

  // 14. Seller profile provides demo placeholder safely without exposing private secrets
  it('14. Seller profile configuration marks unverified profile as DEMO in non-production', () => {
    const profile = getSellerProfile();
    expect(profile).toBeDefined();
    expect(profile.companyName).toBeTruthy();
    if (!profile.isConfigured) {
      expect(profile.isDemo).toBe(true);
      expect(profile.companyName).toContain('DEMO');
    }
  });
});

