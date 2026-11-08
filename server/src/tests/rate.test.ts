import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma } from '../config/prisma';

describe('Rate Master Management Suite (/api/rates)', () => {
  let estimatorCookie: string[] = [];
  let salesHeadCookie: string[] = [];

  const testMaterialCode = 'TEST-MAT-SS304';
  const testOperationCode = 'TEST-MACH-VMC100';

  beforeAll(async () => {
    // 1. Authenticate Estimator
    const estimatorLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'estimator@forgequote.io',
        password: process.env.SEED_ESTIMATOR_PASSWORD || 'ForgeQuote@2026',
      });
    expect(estimatorLogin.status).toBe(200);
    estimatorCookie = estimatorLogin.headers['set-cookie'] || [];

    // 2. Authenticate Sales Head
    const salesHeadLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'saleshead@forgequote.io',
        password: process.env.SEED_SALES_HEAD_PASSWORD || 'ForgeQuote@2026',
      });
    expect(salesHeadLogin.status).toBe(200);
    salesHeadCookie = salesHeadLogin.headers['set-cookie'] || [];
  });

  afterAll(async () => {
    // Clean up all dynamically generated test rate records safely without touching seeded rates
    await prisma.materialRate.deleteMany({
      where: { materialCode: { startsWith: 'TEST-MAT-' } },
    });
    await prisma.machineRate.deleteMany({
      where: { operationCode: { startsWith: 'TEST-MACH-' } },
    });
    await prisma.$disconnect();
  });

  // Test 1: Estimator can view material rates
  it('1. Estimator can view material rates', async () => {
    const res = await request(app)
      .get('/api/rates/materials')
      .set('Cookie', estimatorCookie);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(Array.isArray(res.body.data.rates)).toBe(true);
    expect(res.body.data.pagination).toBeDefined();
  });

  // Test 2: Sales Head can view material rates
  it('2. Sales Head can view material rates', async () => {
    const res = await request(app)
      .get('/api/rates/materials')
      .set('Cookie', salesHeadCookie);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(Array.isArray(res.body.data.rates)).toBe(true);
  });

  // Test 3: Estimator can create a material rate
  it('3. Estimator can create a material rate', async () => {
    const res = await request(app)
      .post('/api/rates/materials')
      .set('Cookie', estimatorCookie)
      .send({
        materialCode: testMaterialCode,
        materialName: 'Stainless Steel 304 Bar',
        ratePerKg: 285.5,
        currency: 'INR',
        validFrom: '2026-01-01T00:00:00.000Z',
        validTo: '2026-06-30T23:59:59.000Z',
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data.rate).toBeDefined();
    expect(res.body.data.rate.materialCode).toBe(testMaterialCode);
    expect(res.body.data.rate.ratePerKg).toBe(285.5);
    expect(res.body.data.rate.currency).toBe('INR');
  });

  // Test 4: Sales Head cannot create a material rate (403 Forbidden)
  it('4. Sales Head cannot create a material rate', async () => {
    const res = await request(app)
      .post('/api/rates/materials')
      .set('Cookie', salesHeadCookie)
      .send({
        materialCode: 'TEST-MAT-UNAUTH',
        materialName: 'Unauthorized Material',
        ratePerKg: 100,
        validFrom: '2026-01-01T00:00:00.000Z',
      });

    expect(res.status).toBe(403);
    expect(res.body.status).toBe('error');
  });

  // Test 5: Estimator can create a machine rate
  it('5. Estimator can create a machine rate', async () => {
    const res = await request(app)
      .post('/api/rates/machines')
      .set('Cookie', estimatorCookie)
      .send({
        operationCode: testOperationCode,
        operationName: '5-Axis Precision Milling',
        machineName: 'Mazak Variaxis C-600',
        hourlyRate: 1850.0,
        currency: 'INR',
        validFrom: '2026-01-01T00:00:00.000Z',
        validTo: '2026-06-30T23:59:59.000Z',
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data.rate.operationCode).toBe(testOperationCode);
    expect(res.body.data.rate.hourlyRate).toBe(1850);
  });

  // Test 6: Sales Head cannot create a machine rate (403 Forbidden)
  it('6. Sales Head cannot create a machine rate', async () => {
    const res = await request(app)
      .post('/api/rates/machines')
      .set('Cookie', salesHeadCookie)
      .send({
        operationCode: 'TEST-MACH-UNAUTH',
        operationName: 'Unauthorized Op',
        machineName: 'Unauthorized Machine',
        hourlyRate: 500,
        validFrom: '2026-01-01T00:00:00.000Z',
      });

    expect(res.status).toBe(403);
    expect(res.body.status).toBe('error');
  });

  // Test 7: Historical rate versions are preserved
  it('7. Historical rate versions are preserved', async () => {
    // Add version 2 for the same material valid from July onward
    const resVersion2 = await request(app)
      .post('/api/rates/materials')
      .set('Cookie', estimatorCookie)
      .send({
        materialCode: testMaterialCode,
        materialName: 'Stainless Steel 304 Bar',
        ratePerKg: 310.0,
        currency: 'INR',
        validFrom: '2026-07-01T00:00:00.000Z',
        validTo: null,
      });

    expect(resVersion2.status).toBe(201);

    // Verify both versions exist in database
    const versions = await prisma.materialRate.findMany({
      where: { materialCode: testMaterialCode },
      orderBy: { validFrom: 'asc' },
    });

    expect(versions.length).toBe(2);
    expect(Number(versions[0].ratePerKg)).toBe(285.5);
    expect(Number(versions[1].ratePerKg)).toBe(310.0);
  });

  // Test 8: Overlapping material rate dates are rejected
  it('8. Overlapping material rate dates are rejected', async () => {
    // Attempt to insert a version overlapping with Version 1 (Jan-June)
    const resOverlap = await request(app)
      .post('/api/rates/materials')
      .set('Cookie', estimatorCookie)
      .send({
        materialCode: testMaterialCode,
        materialName: 'Stainless Steel 304 Bar',
        ratePerKg: 295.0,
        validFrom: '2026-03-01T00:00:00.000Z',
        validTo: '2026-05-31T23:59:59.000Z',
      });

    expect(resOverlap.status).toBe(400);
    expect(resOverlap.body.status).toBe('error');
    expect(resOverlap.body.message).toContain('overlaps');
  });

  // Test 9: Overlapping machine rate dates are rejected
  it('9. Overlapping machine rate dates are rejected', async () => {
    // Attempt to insert a version overlapping with existing Jan-June range
    const resOverlap = await request(app)
      .post('/api/rates/machines')
      .set('Cookie', estimatorCookie)
      .send({
        operationCode: testOperationCode,
        operationName: '5-Axis Precision Milling',
        machineName: 'Mazak Variaxis C-600',
        hourlyRate: 1950.0,
        validFrom: '2026-02-01T00:00:00.000Z',
        validTo: '2026-08-31T23:59:59.000Z',
      });

    expect(resOverlap.status).toBe(400);
    expect(resOverlap.body.status).toBe('error');
    expect(resOverlap.body.message).toContain('overlaps');
  });

  // Test 10: Invalid effective date ranges are rejected (validTo < validFrom)
  it('10. Invalid effective date ranges are rejected', async () => {
    const res = await request(app)
      .post('/api/rates/materials')
      .set('Cookie', estimatorCookie)
      .send({
        materialCode: 'TEST-MAT-INVDATE',
        materialName: 'Invalid Date Test Material',
        ratePerKg: 150.0,
        validFrom: '2026-08-01T00:00:00.000Z',
        validTo: '2026-05-01T00:00:00.000Z',
      });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
  });

  // Test 11: Historical rate lookup returns correct versions
  it('11. Historical rate lookup returns correct versions', async () => {
    const res = await request(app)
      .get(`/api/rates/materials/${testMaterialCode}/history`)
      .set('Cookie', salesHeadCookie);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.history.length).toBe(2);
    // Ordered by validFrom DESC
    expect(res.body.data.history[0].ratePerKg).toBe(310.0);
    expect(res.body.data.history[1].ratePerKg).toBe(285.5);
  });

  // Test 12: Unauthenticated requests return 401
  it('12. Unauthenticated requests return 401', async () => {
    const resMaterial = await request(app).get('/api/rates/materials');
    expect(resMaterial.status).toBe(401);

    const resMachine = await request(app).get('/api/rates/machines');
    expect(resMachine.status).toBe(401);
  });

  // Preserved machine rates test
  it('should confirm existing seeded machine rates are preserved', async () => {
    const res = await request(app)
      .get('/api/rates/machines')
      .set('Cookie', estimatorCookie);

    expect(res.status).toBe(200);
    const codes = res.body.data.rates.map((r: any) => r.operationCode);
    expect(codes).toContain('MACH-RATE-850');
    expect(codes).toContain('MACH-RATE-1450');
    expect(codes).toContain('MACH-RATE-950');
  });
});

