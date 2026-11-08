import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma } from '../config/prisma';
import { UserRole, RfqStatus, Prisma } from '@prisma/client';
import { costingService } from '../services/costing.service';

describe('Deterministic Costing Engine & Quotation Suite (/api/rfqs/:rfqId/quotations)', () => {
  let estimatorCookie: string[] = [];
  let salesHeadCookie: string[] = [];
  let testCustomerId: string;
  let testRfqId: string;
  let testPartId: string;

  const testMaterialCode = 'TEST-COST-MAT1';
  const testMachineCode1 = 'TEST-COST-MACH1';
  const testMachineCode2 = 'TEST-COST-MACH2';
  const testExpiredMaterial = 'TEST-EXP-MAT';
  const testFutureMaterial = 'TEST-FUT-MAT';

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

    const salesHeadLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'saleshead@forgequote.io',
        password: process.env.SEED_SALES_HEAD_PASSWORD || 'ForgeQuote@2026',
      });
    expect(salesHeadLogin.status).toBe(200);
    salesHeadCookie = salesHeadLogin.headers['set-cookie'] || [];

    // 2. Create isolated test customer & RFQ with routing operations
    const customer = await prisma.customer.create({
      data: {
        name: 'Test Costing Customer Inc',
        industry: 'Precision Engineering',
      },
    });
    testCustomerId = customer.id;

    const rfq = await prisma.rfq.create({
      data: {
        rfqNumber: 'RFQ-TEST-COST-001',
        title: 'Precision Machined Flange Costing',
        customerId: testCustomerId,
        status: RfqStatus.ESTIMATING,
      },
    });
    testRfqId = rfq.id;

    const part = await prisma.rfqPart.create({
      data: {
        rfqId: testRfqId,
        partName: 'Precision Drive Flange',
        material: testMaterialCode,
        grossWeightKg: new Prisma.Decimal('2.0000'),
        annualVolume: 50000,
      },
    });
    testPartId = part.id;

    // Operation 1: Setup 60 min, Cycle 6 min
    await prisma.routingOperation.create({
      data: {
        partId: testPartId,
        sequence: 1,
        operationName: 'CNC Flange Turning',
        machineCode: testMachineCode1,
        setupTimeMinutes: new Prisma.Decimal('60.00'),
        cycleTimeMinutes: new Prisma.Decimal('6.00'),
      },
    });

    // Operation 2: Setup 120 min, Cycle 12 min
    await prisma.routingOperation.create({
      data: {
        partId: testPartId,
        sequence: 2,
        operationName: 'VMC Bolt Hole Milling',
        machineCode: testMachineCode2,
        setupTimeMinutes: new Prisma.Decimal('120.00'),
        cycleTimeMinutes: new Prisma.Decimal('12.00'),
      },
    });

    // 3. Create active test rates
    await prisma.materialRate.create({
      data: {
        materialCode: testMaterialCode,
        materialName: 'Test Costing Alloy Steel',
        ratePerKg: new Prisma.Decimal('100.0000'),
        currency: 'INR',
        validFrom: new Date('2026-01-01T00:00:00Z'),
        validTo: null,
      },
    });

    await prisma.machineRate.create({
      data: {
        operationCode: testMachineCode1,
        operationName: 'Test CNC Cell',
        machineName: 'Standard CNC Lathe',
        hourlyRate: new Prisma.Decimal('600.0000'),
        currency: 'INR',
        validFrom: new Date('2026-01-01T00:00:00Z'),
        validTo: null,
      },
    });

    await prisma.machineRate.create({
      data: {
        operationCode: testMachineCode2,
        operationName: 'Test VMC Cell',
        machineName: 'Precision 3-Axis VMC',
        hourlyRate: new Prisma.Decimal('900.0000'),
        currency: 'INR',
        validFrom: new Date('2026-01-01T00:00:00Z'),
        validTo: null,
      },
    });

    // Create expired material rate
    await prisma.materialRate.create({
      data: {
        materialCode: testExpiredMaterial,
        materialName: 'Expired Test Material',
        ratePerKg: new Prisma.Decimal('50.0000'),
        validFrom: new Date('2025-01-01T00:00:00Z'),
        validTo: new Date('2025-12-31T23:59:59Z'),
      },
    });

    // Create future material rate
    await prisma.materialRate.create({
      data: {
        materialCode: testFutureMaterial,
        materialName: 'Future Test Material',
        ratePerKg: new Prisma.Decimal('150.0000'),
        validFrom: new Date('2030-01-01T00:00:00Z'),
        validTo: null,
      },
    });
  });

  afterAll(async () => {
    // Safe cleanup of isolated test data
    await prisma.quotation.deleteMany({
      where: { rfqId: testRfqId },
    });
    await prisma.rfq.deleteMany({
      where: { id: testRfqId },
    });
    await prisma.customer.deleteMany({
      where: { id: testCustomerId },
    });
    await prisma.materialRate.deleteMany({
      where: {
        materialCode: {
          in: [testMaterialCode, testExpiredMaterial, testFutureMaterial],
        },
      },
    });
    await prisma.machineRate.deleteMany({
      where: {
        operationCode: { in: [testMachineCode1, testMachineCode2] },
      },
    });
    await prisma.$disconnect();
  });

  const baseCostingPayload = {
    rfqPartId: '',
    scrapPercentage: 5,
    overheadPercentage: 10,
    freightPerUnit: 5.0,
    marginPercentage: 20,
    gstPercentage: 18,
    volumeScenarios: [1000, 2000, 5000],
    quotationDate: '2026-06-01T00:00:00Z',
  };

  // Test 1: Material cost calculation
  // Gross weight (2 kg) * Rate (100/kg) = 200.00
  it('1. Material cost calculation is exact', async () => {
    const payload = { ...baseCostingPayload, rfqPartId: testPartId };
    const result = await costingService.calculateCosting(testPartId, payload);
    expect(result.scenarios[0].materialCost).toBe(200.0);
  });

  // Test 2: Multiple routing operation process-cost calculation
  // Op1 cycle = 6*600/60 = 60; Op2 cycle = 12*900/60 = 180. Cycle subtotal = 240
  it('2. Multiple routing operation process-cost calculation is exact', async () => {
    const payload = { ...baseCostingPayload, rfqPartId: testPartId };
    const result = await costingService.calculateCosting(testPartId, payload);
    const opDetails = result.scenarios[0].operationDetails;
    expect(opDetails.length).toBe(2);
    expect(opDetails[0].cycleCost).toBe(60.0);
    expect(opDetails[1].cycleCost).toBe(180.0);
  });

  // Test 3: Setup cost allocation for different production volumes
  // Q=1000: Op1 setup = 60*600/(60*1000) = 0.60; Op2 setup = 120*900/(60*1000) = 1.80. Process = 242.40
  // Q=2000: Op1 setup = 0.30; Op2 setup = 0.90. Process = 241.20
  it('3. Setup cost allocation for different production volumes', async () => {
    const payload = { ...baseCostingPayload, rfqPartId: testPartId };
    const result = await costingService.calculateCosting(testPartId, payload);
    // Q=1000
    expect(result.scenarios[0].processCost).toBe(242.4);
    // Q=2000
    expect(result.scenarios[1].processCost).toBe(241.2);
  });

  // Test 4: Scrap calculation
  // Material cost (200) * 5% = 10.00
  it('4. Scrap calculation is exact', async () => {
    const payload = { ...baseCostingPayload, rfqPartId: testPartId };
    const result = await costingService.calculateCosting(testPartId, payload);
    expect(result.scenarios[0].scrapCost).toBe(10.0);
  });

  // Test 5: Overhead calculation
  // (Material 200 + Process 242.40 + Scrap 10) * 10% = 452.40 * 0.10 = 45.24
  it('5. Overhead calculation is exact', async () => {
    const payload = { ...baseCostingPayload, rfqPartId: testPartId };
    const result = await costingService.calculateCosting(testPartId, payload);
    expect(result.scenarios[0].overheadCost).toBe(45.24);
  });

  // Test 6: Freight calculation
  // Freight per unit = 5.00
  it('6. Freight calculation is exact', async () => {
    const payload = { ...baseCostingPayload, rfqPartId: testPartId };
    const result = await costingService.calculateCosting(testPartId, payload);
    expect(result.scenarios[0].freightCost).toBe(5.0);
    // Total cost for Q=1000 = 200 + 242.40 + 10 + 45.24 + 5 = 502.64
    expect(result.scenarios[0].totalCost).toBe(502.64);
  });

  // Test 7: Gross-margin selling-price calculation
  // Selling Price = Total Cost / (1 - 20%) = 502.64 / 0.8 = 628.30
  it('7. Gross-margin selling-price calculation', async () => {
    const payload = { ...baseCostingPayload, rfqPartId: testPartId };
    const result = await costingService.calculateCosting(testPartId, payload);
    expect(result.scenarios[0].sellingPriceBeforeGst).toBe(628.3);
  });

  // Test 8: GST calculation
  // GST Amount = 628.30 * 18% = 113.0940; Incl GST = 741.3940
  it('8. GST calculation is exact', async () => {
    const payload = { ...baseCostingPayload, rfqPartId: testPartId };
    const result = await costingService.calculateCosting(testPartId, payload);
    expect(result.scenarios[0].gstAmount).toBe(113.094);
    expect(result.scenarios[0].sellingPriceWithGst).toBe(741.394);
  });

  // Test 9: Annual value calculation
  // Annual Value = 628.30 * 50000 = 31415000
  it('9. Annual value calculation is exact', async () => {
    const payload = { ...baseCostingPayload, rfqPartId: testPartId };
    const result = await costingService.calculateCosting(testPartId, payload);
    expect(result.scenarios[0].annualValue).toBe(31415000);
  });

  // Test 10: Two-volume and three-volume scenarios
  it('10. Two-volume and three-volume scenarios work properly', async () => {
    // 2-volume scenario
    const payload2 = { ...baseCostingPayload, rfqPartId: testPartId, volumeScenarios: [1000, 5000] };
    const result2 = await costingService.calculateCosting(testPartId, payload2);
    expect(result2.scenarios.length).toBe(2);

    // 3-volume scenario
    const payload3 = { ...baseCostingPayload, rfqPartId: testPartId, volumeScenarios: [1000, 2500, 10000] };
    const result3 = await costingService.calculateCosting(testPartId, payload3);
    expect(result3.scenarios.length).toBe(3);
  });

  // Test 11: Effective material-rate selection
  it('11. Effective material-rate selection matches quotation date', async () => {
    const rate = await costingService.resolveEffectiveMaterialRate(
      testMaterialCode,
      new Date('2026-06-01T00:00:00Z')
    );
    expect(rate.materialCode).toBe(testMaterialCode);
    expect(Number(rate.ratePerKg)).toBe(100.0);
  });

  // Test 12: Effective machine-rate selection
  it('12. Effective machine-rate selection matches quotation date', async () => {
    const rate = await costingService.resolveEffectiveMachineRate(
      testMachineCode1,
      new Date('2026-06-01T00:00:00Z')
    );
    expect(rate.operationCode).toBe(testMachineCode1);
    expect(Number(rate.hourlyRate)).toBe(600.0);
  });

  // Test 13: Missing material rate rejection
  it('13. Missing material rate rejection', async () => {
    await expect(
      costingService.resolveEffectiveMaterialRate('NONEXISTENT-MATERIAL', new Date('2026-06-01Z'))
    ).rejects.toThrow('No material rate found');
  });

  // Test 14: Missing machine rate rejection
  it('14. Missing machine rate rejection', async () => {
    await expect(
      costingService.resolveEffectiveMachineRate('NONEXISTENT-MACHINE', new Date('2026-06-01Z'))
    ).rejects.toThrow('No machine rate found');
  });

  // Test 15: Expired rate rejection
  it('15. Expired rate rejection', async () => {
    await expect(
      costingService.resolveEffectiveMaterialRate(testExpiredMaterial, new Date('2026-06-01Z'))
    ).rejects.toThrow('expired');
  });

  // Test 16: Future rate rejection
  it('16. Future rate rejection', async () => {
    await expect(
      costingService.resolveEffectiveMaterialRate(testFutureMaterial, new Date('2026-06-01Z'))
    ).rejects.toThrow('future');
  });

  // Test 17: Invalid margin rejection (>= 100% or negative)
  it('17. Invalid margin rejection (>= 100% or negative)', async () => {
    const resOver100 = await request(app)
      .post(`/api/rfqs/${testRfqId}/quotations/preview`)
      .set('Cookie', estimatorCookie)
      .send({
        ...baseCostingPayload,
        rfqPartId: testPartId,
        marginPercentage: 100,
      });

    expect(resOver100.status).toBe(400);

    const resNegative = await request(app)
      .post(`/api/rfqs/${testRfqId}/quotations/preview`)
      .set('Cookie', estimatorCookie)
      .send({
        ...baseCostingPayload,
        rfqPartId: testPartId,
        marginPercentage: -5,
      });

    expect(resNegative.status).toBe(400);
  });

  // Test 18: Negative input rejection
  it('18. Negative input rejection', async () => {
    const res = await request(app)
      .post(`/api/rfqs/${testRfqId}/quotations/preview`)
      .set('Cookie', estimatorCookie)
      .send({
        ...baseCostingPayload,
        rfqPartId: testPartId,
        scrapPercentage: -2,
      });

    expect(res.status).toBe(400);
  });

  // Test 19: Duplicate volume rejection
  it('19. Duplicate volume rejection', async () => {
    const res = await request(app)
      .post(`/api/rfqs/${testRfqId}/quotations/preview`)
      .set('Cookie', estimatorCookie)
      .send({
        ...baseCostingPayload,
        rfqPartId: testPartId,
        volumeScenarios: [1000, 1000],
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Duplicate production volume');
  });

  // Test 20: Estimator can preview costing
  it('20. Estimator can preview costing via API', async () => {
    const res = await request(app)
      .post(`/api/rfqs/${testRfqId}/quotations/preview`)
      .set('Cookie', estimatorCookie)
      .send({
        ...baseCostingPayload,
        rfqPartId: testPartId,
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.scenarios.length).toBe(3);
    expect(res.body.data.scenarios[0].sellingPriceBeforeGst).toBe(628.3);
  });

  // Test 21: Sales Head cannot create quotations (403 Forbidden)
  it('21. Sales Head cannot create quotations', async () => {
    const res = await request(app)
      .post(`/api/rfqs/${testRfqId}/quotations`)
      .set('Cookie', salesHeadCookie)
      .send({
        ...baseCostingPayload,
        rfqPartId: testPartId,
      });

    expect(res.status).toBe(403);
    expect(res.body.status).toBe('error');
  });

  // Test 22: Estimator can save a DRAFT quotation
  let savedQuotationId: string;
  it('22. Estimator can save a DRAFT quotation', async () => {
    const res = await request(app)
      .post(`/api/rfqs/${testRfqId}/quotations`)
      .set('Cookie', estimatorCookie)
      .send({
        ...baseCostingPayload,
        rfqPartId: testPartId,
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data.quotation).toBeDefined();
    expect(res.body.data.quotation.status).toBe('DRAFT');
    expect(res.body.data.quotation.quoteNumber).toMatch(/^Q-TEST-COST-001-V\d+$/);
    expect(res.body.data.quotation.quoteParts.length).toBe(1);
    expect(res.body.data.quotation.quoteParts[0].volumePrices.length).toBe(3);

    savedQuotationId = res.body.data.quotation.id;
  });

  // Test 23: Saved rate snapshots remain unchanged after a new rate version is created
  it('23. Saved rate snapshots remain unchanged after a new rate version is created', async () => {
    // Create a new version of the material rate with a higher price
    const newRate = await prisma.materialRate.create({
      data: {
        materialCode: testMaterialCode,
        materialName: 'Test Costing Alloy Steel Updated',
        ratePerKg: new Prisma.Decimal('150.0000'),
        currency: 'INR',
        validFrom: new Date('2027-01-01T00:00:00Z'),
        validTo: null,
      },
    });

    // Inspect previously saved quotePart snapshot
    const quoteInDb = await prisma.quotation.findUnique({
      where: { id: savedQuotationId },
      include: { quoteParts: true },
    });

    const snapshot = quoteInDb?.quoteParts[0].rateSnapshot as any;
    expect(snapshot.material.ratePerKg).toBe(100.0);
    expect(snapshot.material.id).not.toBe(newRate.id);

    // Clean up temporary future rate
    await prisma.materialRate.delete({ where: { id: newRate.id } });
  });

  // Test 24: Historical quotation prices remain unchanged after Rate Master updates
  it('24. Historical quotation prices remain unchanged after Rate Master updates', async () => {
    const quoteInDb = await prisma.quotation.findUnique({
      where: { id: savedQuotationId },
      include: {
        quoteParts: {
          include: { volumePrices: { orderBy: { productionVolume: 'asc' } } },
        },
      },
    });

    const v1Price = Number(quoteInDb?.quoteParts[0].volumePrices[0].sellingPricePerUnit);
    expect(v1Price).toBe(628.3);
  });

  // Test 25: Quotation version uniqueness under sequential/concurrent generation
  it('25. Quotation version increments correctly and preserves uniqueness', async () => {
    const resV2 = await request(app)
      .post(`/api/rfqs/${testRfqId}/quotations`)
      .set('Cookie', estimatorCookie)
      .send({
        ...baseCostingPayload,
        rfqPartId: testPartId,
        marginPercentage: 25,
      });

    expect(resV2.status).toBe(201);
    expect(resV2.body.data.quotation.version).toBe(2);
    expect(resV2.body.data.quotation.quoteNumber).toBe('Q-TEST-COST-001-V2');
  });
});

