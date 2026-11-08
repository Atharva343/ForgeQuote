import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma } from '../config/prisma';
import { UserRole, RfqStatus, QuotationStatus, Prisma } from '@prisma/client';

describe('Sales Head Approval Workflow Suite (/api/quotations & /api/approvals)', () => {
  let estimatorCookie: string[] = [];
  let salesHeadCookie: string[] = [];
  let estimatorUser: any;
  let salesHeadUser: any;

  let testCustomerId: string;
  let testRfqId: string;
  let testPartHighValId: string;
  let testPartLowValId: string;
  let testPartExactThresholdId: string;
  let testPartGstEdgeId: string;

  const testMaterialCode = 'TEST-APPR-MAT';
  const testMachineCode = 'TEST-APPR-MACH';

  let quoteVersionCounter = 1;

  // Helper to create a complete DRAFT quotation with custom volume price annual value
  async function createDraftQuotationWithAnnualValue(
    quoteNumber: string,
    rfqPartId: string,
    annualValues: number[],
    preGstPrices?: number[]
  ) {
    const version = quoteVersionCounter++;
    const uniqueQuoteNumber = `${quoteNumber}-v${version}-${Date.now()}`;

    return await prisma.quotation.create({
      data: {
        quoteNumber: uniqueQuoteNumber,
        rfqId: testRfqId,
        version,
        status: QuotationStatus.DRAFT,
        createdById: estimatorUser.id,
        quoteParts: {
          create: {
            rfqPartId,
            rateSnapshot: {
              material: { code: testMaterialCode, rate: 100 },
              routing: [{ code: testMachineCode, rate: 600 }],
            },
            costBreakdown: {
              scrapPercentage: 5,
              overheadPercentage: 10,
              marginPercentage: 15,
            },
            volumePrices: {
              create: annualValues.map((annVal, idx) => ({
                productionVolume: (idx + 1) * 1000,
                materialCost: new Prisma.Decimal('50.0000'),
                processCost: new Prisma.Decimal('30.0000'),
                scrapCost: new Prisma.Decimal('2.5000'),
                overheadCost: new Prisma.Decimal('8.2500'),
                freightCost: new Prisma.Decimal('2.5000'),
                totalCost: new Prisma.Decimal('93.2500'),
                marginPercentage: new Prisma.Decimal('15.00'),
                sellingPricePerUnit: new Prisma.Decimal(
                  preGstPrices && preGstPrices[idx]
                    ? preGstPrices[idx].toString()
                    : (annVal / 10000).toString()
                ),
                annualValue: new Prisma.Decimal(annVal.toString()),
                gstPercentage: new Prisma.Decimal('18.00'),
              })),
            },
          },
        },
      },
      include: {
        quoteParts: {
          include: { volumePrices: true },
        },
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

    // 2. Setup isolated customer & RFQ
    const testRfqNumber = `RFQ-TEST-APPR-${Date.now()}`;

    const customer = await prisma.customer.create({
      data: {
        name: `Test Approval Aerospace Ltd ${Date.now()}`,
        industry: 'Aerospace & Defense',
      },
    });
    testCustomerId = customer.id;

    const rfq = await prisma.rfq.create({
      data: {
        rfqNumber: testRfqNumber,
        title: 'Aerospace Valve Assembly',
        customerId: testCustomerId,
        status: RfqStatus.ESTIMATING,
      },
    });
    testRfqId = rfq.id;

    // High-value part (> 25 Lakh)
    const partHigh = await prisma.rfqPart.create({
      data: {
        rfqId: testRfqId,
        partName: 'Turbine Rotor Flange',
        material: testMaterialCode,
        grossWeightKg: new Prisma.Decimal('5.0000'),
        annualVolume: 50000,
      },
    });
    testPartHighValId = partHigh.id;

    // Low-value part (< 25 Lakh)
    const partLow = await prisma.rfqPart.create({
      data: {
        rfqId: testRfqId,
        partName: 'Manifold Bracket',
        material: testMaterialCode,
        grossWeightKg: new Prisma.Decimal('1.0000'),
        annualVolume: 5000,
      },
    });
    testPartLowValId = partLow.id;

    // Exactly 25 Lakh part
    const partExact = await prisma.rfqPart.create({
      data: {
        rfqId: testRfqId,
        partName: 'Exact Threshold Bushing',
        material: testMaterialCode,
        grossWeightKg: new Prisma.Decimal('2.0000'),
        annualVolume: 10000,
      },
    });
    testPartExactThresholdId = partExact.id;

    // GST Edge part (Pre-GST = 24L, with GST = 28.32L)
    const partGstEdge = await prisma.rfqPart.create({
      data: {
        rfqId: testRfqId,
        partName: 'GST Edge Component',
        material: testMaterialCode,
        grossWeightKg: new Prisma.Decimal('2.5000'),
        annualVolume: 12000,
      },
    });
    testPartGstEdgeId = partGstEdge.id;
  });

  afterAll(async () => {
    // Clean up test data
    if (testRfqId) {
      const testQuotes = await prisma.quotation.findMany({
        where: { rfqId: testRfqId },
        select: { id: true },
      });
      const quoteIds = testQuotes.map((q) => q.id);

      if (quoteIds.length > 0) {
        await prisma.quoteApproval.deleteMany({
          where: { quotationId: { in: quoteIds } },
        });
        await prisma.auditLog.deleteMany({
          where: {
            entityType: 'QUOTATION',
            entityId: { in: quoteIds },
          },
        });
        await prisma.quotation.deleteMany({
          where: { id: { in: quoteIds } },
        });
      }

      await prisma.rfq.deleteMany({
        where: { id: testRfqId },
      });
    }

    if (testCustomerId) {
      await prisma.customer.deleteMany({
        where: { id: testCustomerId },
      });
    }
  });

  // 1 & 2. Estimator submits quotation above 25 Lakh -> PENDING_APPROVAL
  it('1 & 2. Estimator submits quotation above 25 lakh, entering PENDING_APPROVAL status', async () => {
    const highValQuote = await createDraftQuotationWithAnnualValue(
      'QUO-TEST-HIGH-01',
      testPartHighValId,
      [1500000, 3200000, 2800000] // Highest is 32 Lakh > 25 Lakh
    );

    const res = await request(app)
      .post(`/api/quotations/${highValQuote.id}/submit`)
      .set('Cookie', estimatorCookie)
      .send({ comments: 'Please review turbine rotor pricing' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.quotation.status).toBe('PENDING_APPROVAL');
    expect(res.body.data.requiresApproval).toBe(true);
    expect(res.body.data.evaluatedAnnualValue).toBe(3200000);
    expect(res.body.data.thresholdValue).toBe(2500000);

    // Verify DB state
    const dbQuote = await prisma.quotation.findUnique({
      where: { id: highValQuote.id },
    });
    expect(dbQuote?.status).toBe('PENDING_APPROVAL');
    expect(dbQuote?.submittedAt).not.toBeNull();
    expect(dbQuote?.approvedAt).toBeNull();
  });

  // 3 & 4. Estimator submits quotation below 25 Lakh -> auto-approved
  it('3 & 4. Estimator submits quotation below 25 lakh, auto-approving directly with audit log', async () => {
    const lowValQuote = await createDraftQuotationWithAnnualValue(
      'QUO-TEST-LOW-01',
      testPartLowValId,
      [800000, 1200000, 1500000] // Highest is 15 Lakh <= 25 Lakh
    );

    const res = await request(app)
      .post(`/api/quotations/${lowValQuote.id}/submit`)
      .set('Cookie', estimatorCookie)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.quotation.status).toBe('APPROVED');
    expect(res.body.data.requiresApproval).toBe(false);
    expect(res.body.data.evaluatedAnnualValue).toBe(1500000);

    // Verify DB state
    const dbQuote = await prisma.quotation.findUnique({
      where: { id: lowValQuote.id },
    });
    expect(dbQuote?.status).toBe('APPROVED');
    expect(dbQuote?.submittedAt).not.toBeNull();
    expect(dbQuote?.approvedAt).not.toBeNull();

    // Verify Audit Log
    const auditLogs = await prisma.auditLog.findMany({
      where: { entityType: 'QUOTATION', entityId: lowValQuote.id },
    });
    expect(auditLogs.length).toBeGreaterThan(0);
    expect(auditLogs[0].action).toBe('QUOTATION_AUTO_APPROVED');
    expect((auditLogs[0].details as any).requiresApproval).toBe(false);
  });

  // 5. Exactly 25 Lakh does not require Sales Head approval
  it('5. Exactly ₹25 lakh does not require Sales Head approval and is auto-approved', async () => {
    const exactQuote = await createDraftQuotationWithAnnualValue(
      'QUO-TEST-EXACT-01',
      testPartExactThresholdId,
      [1000000, 2000000, 2500000] // Highest is exactly 25,00,000
    );

    const res = await request(app)
      .post(`/api/quotations/${exactQuote.id}/submit`)
      .set('Cookie', estimatorCookie)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.quotation.status).toBe('APPROVED');
    expect(res.body.data.requiresApproval).toBe(false);
    expect(res.body.data.evaluatedAnnualValue).toBe(2500000);
  });

  // 6. GST is strictly excluded from threshold evaluation
  it('6. GST is excluded from threshold evaluation (pre-GST ₹24L with GST ₹28.32L does not require approval)', async () => {
    // Pre-GST annual value: 24,00,000. With 18% GST: 28,32,000.
    const gstEdgeQuote = await createDraftQuotationWithAnnualValue(
      'QUO-TEST-GST-EDGE-01',
      testPartGstEdgeId,
      [2400000]
    );

    const res = await request(app)
      .post(`/api/quotations/${gstEdgeQuote.id}/submit`)
      .set('Cookie', estimatorCookie)
      .send({});

    expect(res.status).toBe(200);
    // Because pre-GST is 24,00,000 <= 25,00,000, it must be APPROVED directly, not PENDING_APPROVAL
    expect(res.body.data.quotation.status).toBe('APPROVED');
    expect(res.body.data.requiresApproval).toBe(false);
    expect(res.body.data.evaluatedAnnualValue).toBe(2400000);
  });

  // 7. Multiple volume scenarios use highest annual pre-GST value
  it('7. Multiple volume scenarios evaluate the threshold using the highest annual pre-GST value', async () => {
    // Scenario 1: 18L, Scenario 2: 22L, Scenario 3: 26L
    const multiVolQuote = await createDraftQuotationWithAnnualValue(
      'QUO-TEST-MULTIVOL-01',
      testPartHighValId,
      [1800000, 2200000, 2600000]
    );

    const res = await request(app)
      .post(`/api/quotations/${multiVolQuote.id}/submit`)
      .set('Cookie', estimatorCookie)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.quotation.status).toBe('PENDING_APPROVAL');
    expect(res.body.data.evaluatedAnnualValue).toBe(2600000);
    expect(res.body.data.requiresApproval).toBe(true);
  });

  // 8. Sales Head can view the approval queue
  it('8. Sales Head can view the approval queue', async () => {
    const res = await request(app)
      .get('/api/approvals/queue')
      .set('Cookie', salesHeadCookie);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.pagination).toBeDefined();

    // Verify items have expected fields
    if (res.body.data.items.length > 0) {
      const item = res.body.data.items[0];
      expect(item.quoteNumber).toBeDefined();
      expect(item.highestAnnualPreGstValue).toBeDefined();
      expect(item.status).toBe('PENDING_APPROVAL');
    }
  });

  // 9. Estimator cannot access the approval queue (HTTP 403)
  it('9. Estimator cannot access the approval queue (HTTP 403 Forbidden)', async () => {
    const res = await request(app)
      .get('/api/approvals/queue')
      .set('Cookie', estimatorCookie);

    expect(res.status).toBe(403);
  });

  // 10. Sales Head can approve a pending quotation
  it('10. Sales Head can approve a pending quotation', async () => {
    const pendingQuote = await createDraftQuotationWithAnnualValue(
      'QUO-TEST-TO-APPROVE-01',
      testPartHighValId,
      [3500000]
    );

    // Submit it first
    await request(app)
      .post(`/api/quotations/${pendingQuote.id}/submit`)
      .set('Cookie', estimatorCookie)
      .send({});

    // Sales Head approves
    const approveRes = await request(app)
      .post(`/api/quotations/${pendingQuote.id}/approve`)
      .set('Cookie', salesHeadCookie)
      .send({ comments: 'Approved after margin review' });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.status).toBe('success');
    expect(approveRes.body.data.quotation.status).toBe('APPROVED');
    expect(approveRes.body.data.approval).toBeDefined();
    expect(approveRes.body.data.approval.status).toBe('APPROVED');

    // Verify DB
    const dbQuote = await prisma.quotation.findUnique({
      where: { id: pendingQuote.id },
    });
    expect(dbQuote?.status).toBe('APPROVED');
    expect(dbQuote?.approvedAt).not.toBeNull();
  });

  // 11. Sales Head can reject a pending quotation
  it('11. Sales Head can reject a pending quotation with a valid reason', async () => {
    const pendingQuote = await createDraftQuotationWithAnnualValue(
      'QUO-TEST-TO-REJECT-01',
      testPartHighValId,
      [4000000]
    );

    // Submit it first
    await request(app)
      .post(`/api/quotations/${pendingQuote.id}/submit`)
      .set('Cookie', estimatorCookie)
      .send({});

    // Sales Head rejects
    const rejectRes = await request(app)
      .post(`/api/quotations/${pendingQuote.id}/reject`)
      .set('Cookie', salesHeadCookie)
      .send({ reason: 'Target margin must be at least 22% for aerospace turbine' });

    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.status).toBe('success');
    expect(rejectRes.body.data.quotation.status).toBe('REJECTED');
    expect(rejectRes.body.data.approval.status).toBe('REJECTED');
    expect(rejectRes.body.data.approval.comments).toContain('Target margin must be at least 22%');

    // Verify DB
    const dbQuote = await prisma.quotation.findUnique({
      where: { id: pendingQuote.id },
    });
    expect(dbQuote?.status).toBe('REJECTED');
  });

  // 12. Rejection without a reason is rejected (HTTP 400)
  it('12. Rejection without a reason is rejected with HTTP 400', async () => {
    const pendingQuote = await createDraftQuotationWithAnnualValue(
      'QUO-TEST-EMPTY-REJECT-01',
      testPartHighValId,
      [4000000]
    );

    await request(app)
      .post(`/api/quotations/${pendingQuote.id}/submit`)
      .set('Cookie', estimatorCookie)
      .send({});

    const res = await request(app)
      .post(`/api/quotations/${pendingQuote.id}/reject`)
      .set('Cookie', salesHeadCookie)
      .send({});

    expect(res.status).toBe(400);

    const emptyRes = await request(app)
      .post(`/api/quotations/${pendingQuote.id}/reject`)
      .set('Cookie', salesHeadCookie)
      .send({ reason: '   ' });

    expect(emptyRes.status).toBe(400);
  });

  // 13. Estimator cannot approve or reject
  it('13. Estimator cannot approve or reject quotations (HTTP 403 Forbidden)', async () => {
    const pendingQuote = await createDraftQuotationWithAnnualValue(
      'QUO-TEST-EST-NO-DECIDE-01',
      testPartHighValId,
      [4000000]
    );

    await request(app)
      .post(`/api/quotations/${pendingQuote.id}/submit`)
      .set('Cookie', estimatorCookie)
      .send({});

    const approveRes = await request(app)
      .post(`/api/quotations/${pendingQuote.id}/approve`)
      .set('Cookie', estimatorCookie)
      .send({});
    expect(approveRes.status).toBe(403);

    const rejectRes = await request(app)
      .post(`/api/quotations/${pendingQuote.id}/reject`)
      .set('Cookie', estimatorCookie)
      .send({ reason: 'Invalid attempt' });
    expect(rejectRes.status).toBe(403);
  });

  // 14. Sales Head cannot submit a quotation
  it('14. Sales Head cannot submit a quotation (HTTP 403 Forbidden)', async () => {
    const draftQuote = await createDraftQuotationWithAnnualValue(
      'QUO-TEST-SH-NO-SUBMIT-01',
      testPartLowValId,
      [1000000]
    );

    const res = await request(app)
      .post(`/api/quotations/${draftQuote.id}/submit`)
      .set('Cookie', salesHeadCookie)
      .send({});

    expect(res.status).toBe(403);
  });

  // 15. DRAFT quotation cannot be approved directly
  it('15. DRAFT quotation cannot be approved directly without submission', async () => {
    const draftQuote = await createDraftQuotationWithAnnualValue(
      'QUO-TEST-DRAFT-NO-APPROVE-01',
      testPartHighValId,
      [4000000]
    );

    const res = await request(app)
      .post(`/api/quotations/${draftQuote.id}/approve`)
      .set('Cookie', salesHeadCookie)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('not pending approval');
  });

  // 16. Already approved quotation cannot be approved again
  it('16. Already approved quotation cannot be approved again', async () => {
    const quote = await createDraftQuotationWithAnnualValue(
      'QUO-TEST-DOUBLE-APPROVE-01',
      testPartHighValId,
      [3000000]
    );

    // Submit -> Pending
    await request(app)
      .post(`/api/quotations/${quote.id}/submit`)
      .set('Cookie', estimatorCookie)
      .send({});

    // First approve -> OK
    const firstApprove = await request(app)
      .post(`/api/quotations/${quote.id}/approve`)
      .set('Cookie', salesHeadCookie)
      .send({});
    expect(firstApprove.status).toBe(200);

    // Second approve -> 400
    const secondApprove = await request(app)
      .post(`/api/quotations/${quote.id}/approve`)
      .set('Cookie', salesHeadCookie)
      .send({});
    expect(secondApprove.status).toBe(400);
  });

  // 17. Rejected quotation cannot be approved
  it('17. Rejected quotation cannot be approved', async () => {
    const quote = await createDraftQuotationWithAnnualValue(
      'QUO-TEST-REJECT-NO-APPROVE-01',
      testPartHighValId,
      [3000000]
    );

    // Submit -> Pending
    await request(app)
      .post(`/api/quotations/${quote.id}/submit`)
      .set('Cookie', estimatorCookie)
      .send({});

    // Reject
    const rejectRes = await request(app)
      .post(`/api/quotations/${quote.id}/reject`)
      .set('Cookie', salesHeadCookie)
      .send({ reason: 'Margin too low' });
    expect(rejectRes.status).toBe(200);

    // Try to approve rejected quote
    const approveRes = await request(app)
      .post(`/api/quotations/${quote.id}/approve`)
      .set('Cookie', salesHeadCookie)
      .send({});
    expect(approveRes.status).toBe(400);
  });

  // 18. Submitted quotation cannot be re-submitted or modified in place
  it('18. Submitted quotation cannot be submitted again or edited in place', async () => {
    const quote = await createDraftQuotationWithAnnualValue(
      'QUO-TEST-NO-RESUBMIT-01',
      testPartLowValId,
      [1000000]
    );

    // First submission
    const res1 = await request(app)
      .post(`/api/quotations/${quote.id}/submit`)
      .set('Cookie', estimatorCookie)
      .send({});
    expect(res1.status).toBe(200);

    // Second submission attempt
    const res2 = await request(app)
      .post(`/api/quotations/${quote.id}/submit`)
      .set('Cookie', estimatorCookie)
      .send({});
    expect(res2.status).toBe(400);
  });

  // 19. Approval history records correct actor, timestamp, and audit trail
  it('19. Approval history records correct actor, timestamp, decision, and values', async () => {
    const quote = await createDraftQuotationWithAnnualValue(
      'QUO-TEST-HISTORY-01',
      testPartHighValId,
      [3600000]
    );

    // Submit
    await request(app)
      .post(`/api/quotations/${quote.id}/submit`)
      .set('Cookie', estimatorCookie)
      .send({ comments: 'Urgent aerospace quote' });

    // Approve
    await request(app)
      .post(`/api/quotations/${quote.id}/approve`)
      .set('Cookie', salesHeadCookie)
      .send({ comments: 'Approved as strategic customer' });

    // Fetch history
    const historyRes = await request(app)
      .get(`/api/quotations/${quote.id}/approval-history`)
      .set('Cookie', estimatorCookie);

    expect(historyRes.status).toBe(200);
    expect(historyRes.body.status).toBe('success');
    expect(Array.isArray(historyRes.body.data.history)).toBe(true);

    const history = historyRes.body.data.history;
    expect(history.length).toBeGreaterThanOrEqual(2);

    const submitEvent = history.find((h: any) => h.decision === 'SUBMITTED');
    expect(submitEvent).toBeDefined();
    expect(submitEvent.actor.email).toBe('estimator@forgequote.io');
    expect(submitEvent.evaluatedAnnualValue).toBe(3600000);
    expect(submitEvent.requiresApproval).toBe(true);

    const approveEvent = history.find((h: any) => h.decision === 'APPROVED');
    expect(approveEvent).toBeDefined();
    expect(approveEvent.actor.email).toBe('saleshead@forgequote.io');
  });

  // 20. Protection against concurrent conflicting decisions
  it('20. Approval and rejection are protected against concurrent conflicting requests', async () => {
    const quote = await createDraftQuotationWithAnnualValue(
      'QUO-TEST-CONCURRENCY-01',
      testPartHighValId,
      [3000000]
    );

    await request(app)
      .post(`/api/quotations/${quote.id}/submit`)
      .set('Cookie', estimatorCookie)
      .send({});

    // Send approve and reject concurrently
    const [resApprove, resReject] = await Promise.all([
      request(app)
        .post(`/api/quotations/${quote.id}/approve`)
        .set('Cookie', salesHeadCookie)
        .send({ comments: 'Simultaneous approve' }),
      request(app)
        .post(`/api/quotations/${quote.id}/reject`)
        .set('Cookie', salesHeadCookie)
        .send({ reason: 'Simultaneous reject' }),
    ]);

    // Exactly one should succeed (200), and the other should fail (400 or 409)
    const successCount = (resApprove.status === 200 ? 1 : 0) + (resReject.status === 200 ? 1 : 0);
    expect(successCount).toBe(1);

    const failureStatus = resApprove.status !== 200 ? resApprove.status : resReject.status;
    expect([400, 409]).toContain(failureStatus);
  });

  // 21. Rate snapshots remain unchanged after approval
  it('21. Existing quotation rate snapshots and pricing remain unchanged after approval', async () => {
    const quote = await createDraftQuotationWithAnnualValue(
      'QUO-TEST-SNAPSHOT-01',
      testPartHighValId,
      [3100000]
    );

    const initialPartSnapshot = quote.quoteParts[0].rateSnapshot;

    // Submit and approve
    await request(app)
      .post(`/api/quotations/${quote.id}/submit`)
      .set('Cookie', estimatorCookie)
      .send({});

    await request(app)
      .post(`/api/quotations/${quote.id}/approve`)
      .set('Cookie', salesHeadCookie)
      .send({});

    // Fetch from DB
    const approvedQuote = await prisma.quotation.findUnique({
      where: { id: quote.id },
      include: { quoteParts: true },
    });

    expect(approvedQuote?.status).toBe('APPROVED');
    expect(approvedQuote?.quoteParts[0].rateSnapshot).toEqual(initialPartSnapshot);
  });

  // 22. Approval threshold cannot be bypassed by client-supplied payload
  it('22. Approval threshold is not bypassed by tampering with frontend request values', async () => {
    const highValQuote = await createDraftQuotationWithAnnualValue(
      'QUO-TEST-TAMPER-01',
      testPartHighValId,
      [5000000] // Actual pre-GST is 50 Lakh > 25 Lakh
    );

    // Attacker attempts to send fake metadata in body
    const res = await request(app)
      .post(`/api/quotations/${highValQuote.id}/submit`)
      .set('Cookie', estimatorCookie)
      .send({
        requiresApproval: false,
        evaluatedAnnualValue: 100000,
        status: 'APPROVED',
        comments: 'Attempting to bypass approval',
      });

    expect(res.status).toBe(200);
    // Backend computes from persisted DB volume prices; cannot be spoofed!
    expect(res.body.data.quotation.status).toBe('PENDING_APPROVAL');
    expect(res.body.data.requiresApproval).toBe(true);
    expect(res.body.data.evaluatedAnnualValue).toBe(5000000);
  });
});
