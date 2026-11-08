import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma } from '../config/prisma';
import { env } from '../config/env';

describe('RFQ Register & Management Suite (/api/rfqs & /api/customers)', () => {
  let estimatorCookie: string[] = [];
  let salesHeadCookie: string[] = [];
  let seededCustomerId: string;
  let testRfqId: string;
  const createdRfqIds: string[] = [];

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

    // 3. Find a seeded customer (Company B)
    const customer = await prisma.customer.findFirst({
      where: { name: 'Company B' },
    });
    if (!customer) {
      throw new Error('Seed customer Company B not found in database');
    }
    seededCustomerId = customer.id;
  });

  afterAll(async () => {
    // Clean up all dynamically created RFQs to avoid corrupting seed data
    if (createdRfqIds.length > 0) {
      await prisma.rfq.deleteMany({
        where: { id: { in: createdRfqIds } },
      });
    }
    await prisma.$disconnect();
  });

  // Test 1: Estimator can retrieve RFQ register
  it('1. Estimator can retrieve RFQ register', async () => {
    const res = await request(app)
      .get('/api/rfqs')
      .set('Cookie', estimatorCookie);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(Array.isArray(res.body.data.rfqs)).toBe(true);
    expect(res.body.data.pagination).toBeDefined();
    expect(res.body.data.pagination.total).toBeGreaterThanOrEqual(3);
  });

  // Test 2: Sales Head can retrieve RFQ register
  it('2. Sales Head can retrieve RFQ register', async () => {
    const res = await request(app)
      .get('/api/rfqs')
      .set('Cookie', salesHeadCookie);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(Array.isArray(res.body.data.rfqs)).toBe(true);
    expect(res.body.data.pagination.total).toBeGreaterThanOrEqual(3);
  });

  // Test 3: Unauthenticated request returns 401
  it('3. Unauthenticated request returns 401', async () => {
    const res = await request(app).get('/api/rfqs');

    expect(res.status).toBe(401);
    expect(res.body.status).toBe('error');
  });

  // Test 4: Search by RFQ number works
  it('4. Search by RFQ number works', async () => {
    const res = await request(app)
      .get('/api/rfqs?search=RFQ-2611-014')
      .set('Cookie', estimatorCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.rfqs.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.rfqs[0].rfqNumber).toBe('RFQ-2611-014');
  });

  // Test 5: Search by customer and part name works
  it('5. Search by customer and part name works', async () => {
    // Search customer
    const resCustomer = await request(app)
      .get('/api/rfqs?search=Company%20C')
      .set('Cookie', estimatorCookie);

    expect(resCustomer.status).toBe(200);
    expect(resCustomer.body.data.rfqs.length).toBeGreaterThanOrEqual(1);
    expect(resCustomer.body.data.rfqs[0].customer.name).toBe('Company C');

    // Search part name
    const resPart = await request(app)
      .get('/api/rfqs?search=spindle')
      .set('Cookie', estimatorCookie);

    expect(resPart.status).toBe(200);
    expect(resPart.body.data.rfqs.length).toBeGreaterThanOrEqual(1);
  });

  // Test 6: Status filter works
  it('6. Status filter works', async () => {
    const res = await request(app)
      .get('/api/rfqs?status=ESTIMATING')
      .set('Cookie', estimatorCookie);

    expect(res.status).toBe(200);
    for (const rfq of res.body.data.rfqs) {
      expect(rfq.status).toBe('ESTIMATING');
    }
  });

  // Test 7: Pagination works
  it('7. Pagination works', async () => {
    const res = await request(app)
      .get('/api/rfqs?page=1&limit=2')
      .set('Cookie', estimatorCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.rfqs.length).toBeLessThanOrEqual(2);
    expect(res.body.data.pagination.page).toBe(1);
    expect(res.body.data.pagination.limit).toBe(2);
    expect(res.body.data.pagination.totalPages).toBeGreaterThanOrEqual(2);
  });

  // Test 8: Estimator can create an RFQ with multiple parts
  it('8. Estimator can create an RFQ with multiple parts', async () => {
    const payload = {
      title: 'Automated Transmission Subassembly RFQ',
      customerId: seededCustomerId,
      description: 'Multi-part precision machining package',
      dueDate: new Date(Date.now() + 14 * 86400000).toISOString(),
      parts: [
        {
          partName: 'Input Shaft Gear',
          partNumber: 'IS-9901',
          drawingNumber: 'DRW-IS-01',
          material: '20MnCr5',
          grossWeightKg: 1.45,
          annualVolume: 50000,
          notes: 'Case carburized',
        },
        {
          partName: 'Countershaft Pinion',
          partNumber: 'CP-9902',
          drawingNumber: 'DRW-CP-02',
          material: '16MnCr5',
          grossWeightKg: 0.95,
          annualVolume: 50000,
          notes: 'Precision ground teeth',
        },
      ],
    };

    const res = await request(app)
      .post('/api/rfqs')
      .set('Cookie', estimatorCookie)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data.rfq).toBeDefined();
    expect(res.body.data.rfq.rfqNumber).toMatch(/^RFQ-\d{4}-\d{3}$/);
    expect(res.body.data.rfq.parts.length).toBe(2);
    expect(res.body.data.rfq.status).toBe('ESTIMATING');

    testRfqId = res.body.data.rfq.id;
    createdRfqIds.push(testRfqId);
  });

  // Test 9: Invalid customer ID is rejected
  it('9. Invalid customer ID is rejected', async () => {
    const payload = {
      title: 'Invalid Customer Test',
      customerId: '00000000-0000-0000-0000-000000000000',
      parts: [
        {
          partName: 'Dummy Part',
          material: 'Mild Steel',
          grossWeightKg: 1.0,
          annualVolume: 1000,
        },
      ],
    };

    const res = await request(app)
      .post('/api/rfqs')
      .set('Cookie', estimatorCookie)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toContain('not found');
  });

  // Test 10: Missing required part information is rejected
  it('10. Missing required part information is rejected', async () => {
    const payload = {
      title: 'Missing Parts Test',
      customerId: seededCustomerId,
      parts: [],
    };

    const res = await request(app)
      .post('/api/rfqs')
      .set('Cookie', estimatorCookie)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
  });

  // Test 11: Estimator can update an RFQ
  it('11. Estimator can update an RFQ', async () => {
    const res = await request(app)
      .patch(`/api/rfqs/${testRfqId}`)
      .set('Cookie', estimatorCookie)
      .send({
        title: 'Updated Transmission Subassembly RFQ',
        description: 'Updated engineering specifications for precision tolerance',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.rfq.title).toBe('Updated Transmission Subassembly RFQ');
    expect(res.body.data.rfq.description).toBe('Updated engineering specifications for precision tolerance');
  });

  // Test 12: Sales Head cannot modify RFQs
  it('12. Sales Head cannot modify RFQs', async () => {
    const res = await request(app)
      .patch(`/api/rfqs/${testRfqId}`)
      .set('Cookie', salesHeadCookie)
      .send({
        title: 'Unauthorized Sales Head Modification',
      });

    expect(res.status).toBe(403);
    expect(res.body.status).toBe('error');
  });

  // Test 13: Lost status without a reason is rejected
  it('13. Lost status without a reason is rejected', async () => {
    const res = await request(app)
      .patch(`/api/rfqs/${testRfqId}/status`)
      .set('Cookie', estimatorCookie)
      .send({
        status: 'LOST',
        lostReason: '',
      });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
  });

  // Test 14: Lost status with a reason succeeds
  it('14. Lost status with a reason succeeds', async () => {
    const res = await request(app)
      .patch(`/api/rfqs/${testRfqId}/status`)
      .set('Cookie', estimatorCookie)
      .send({
        status: 'LOST',
        lostReason: 'Target piece price was 15% below raw material index floor',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.rfq.status).toBe('LOST');
    expect(res.body.data.rfq.lostReason).toBe('Target piece price was 15% below raw material index floor');

    // Also verify moving back to ESTIMATING clears the lostReason
    const resetRes = await request(app)
      .patch(`/api/rfqs/${testRfqId}/status`)
      .set('Cookie', estimatorCookie)
      .send({
        status: 'ESTIMATING',
      });

    expect(resetRes.status).toBe(200);
    expect(resetRes.body.data.rfq.status).toBe('ESTIMATING');
    expect(resetRes.body.data.rfq.lostReason).toBeNull();
  });

  // Test 15: Unknown RFQ ID returns 404
  it('15. Unknown RFQ ID returns 404', async () => {
    const res = await request(app)
      .get('/api/rfqs/00000000-0000-0000-0000-000000000000')
      .set('Cookie', estimatorCookie);

    expect(res.status).toBe(404);
    expect(res.body.status).toBe('error');
  });

  // Additional Customer endpoint test
  it('should allow authenticated users to list customers via GET /api/customers', async () => {
    const res = await request(app)
      .get('/api/customers')
      .set('Cookie', salesHeadCookie);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(Array.isArray(res.body.data.customers)).toBe(true);
    expect(res.body.data.customers.length).toBeGreaterThanOrEqual(3);
  });
});

