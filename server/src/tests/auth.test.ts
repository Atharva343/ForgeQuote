import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
import app from '../app';
import { prisma } from '../config/prisma';
import { env } from '../config/env';

describe('Authentication & Authorization Suite (/api/auth)', () => {
  const estimatorCredentials = {
    email: 'estimator@forgequote.io',
    password: process.env.SEED_ESTIMATOR_PASSWORD || 'ForgeQuote@2026',
  };

  const salesHeadCredentials = {
    email: 'saleshead@forgequote.io',
    password: process.env.SEED_SALES_HEAD_PASSWORD || 'ForgeQuote@2026',
  };

  const inactiveUserEmail = 'inactive-test-user@forgequote.test';

  beforeAll(async () => {
    // Create an inactive test user to verify inactive login rejection
    const passwordHash = await bcrypt.hash('TestInactive@123', 10);
    await prisma.user.upsert({
      where: { email: inactiveUserEmail },
      update: { isActive: false, passwordHash },
      create: {
        name: 'Inactive Test User',
        email: inactiveUserEmail,
        passwordHash,
        role: UserRole.ESTIMATOR,
        isActive: false,
      },
    });
  });

  afterAll(async () => {
    // Clean up temporary inactive test user
    await prisma.user.deleteMany({
      where: { email: inactiveUserEmail },
    });
    await prisma.$disconnect();
  });

  // 1. Successful estimator login
  it('should authenticate Estimator and return safe user info with HTTP-only cookie', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send(estimatorCredentials);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.email).toBe(estimatorCredentials.email);
    expect(res.body.data.user.role).toBe(UserRole.ESTIMATOR);
    expect(res.body.data.user.passwordHash).toBeUndefined();

    // Check Set-Cookie header contains auth cookie and is HttpOnly
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const authCookie = cookies.find((c: string) => c.startsWith(`${env.AUTH_COOKIE_NAME}=`));
    expect(authCookie).toBeDefined();
    expect(authCookie).toContain('HttpOnly');
    expect(authCookie).toContain('SameSite=Lax');
  });

  // 2. Successful Sales Head login
  it('should authenticate Sales Head and return role SALES_HEAD', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send(salesHeadCredentials);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.user.role).toBe(UserRole.SALES_HEAD);
  });

  // 3. Invalid password returns 401
  it('should reject invalid password with HTTP 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: estimatorCredentials.email,
        password: 'WrongPassword123!',
      });

    expect(res.status).toBe(401);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toBe('Invalid email or password');
  });

  // 4. Unknown email returns 401
  it('should reject non-existent user with HTTP 401 generic error', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'unknown-user@nonexistent.domain',
        password: 'SomePassword123',
      });

    expect(res.status).toBe(401);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toBe('Invalid email or password');
  });

  // 5. Inactive users cannot log in
  it('should reject login for inactive users with HTTP 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: inactiveUserEmail,
        password: 'TestInactive@123',
      });

    expect(res.status).toBe(401);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toContain('deactivated');
  });

  // 6. Missing authentication returns 401
  it('should return 401 on GET /api/auth/me when unauthenticated', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.status).toBe('error');
  });

  // 7. Valid authentication returns the current user
  it('should return current user when valid cookie is provided', async () => {
    // Login to get cookie
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send(estimatorCredentials);

    const cookies = loginRes.headers['set-cookie'];

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookies);

    expect(meRes.status).toBe(200);
    expect(meRes.body.status).toBe('success');
    expect(meRes.body.data.user.email).toBe(estimatorCredentials.email);
    expect(meRes.body.data.user.role).toBe(UserRole.ESTIMATOR);
  });

  // 8. Logout clears the cookie
  it('should clear the authentication cookie on POST /api/auth/logout', async () => {
    const res = await request(app).post('/api/auth/logout');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');

    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const authCookie = cookies.find((c: string) => c.startsWith(`${env.AUTH_COOKIE_NAME}=`));
    // Cleared cookie has empty value and expires in past
    expect(authCookie).toMatch(/forgequote_token=;/);
  });

  // 9. Estimator cannot access Sales Head-only endpoints
  it('should reject Estimator accessing Sales Head endpoint with 403', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send(estimatorCredentials);

    const cookies = loginRes.headers['set-cookie'];

    const res = await request(app)
      .get('/api/test/sales-head-only')
      .set('Cookie', cookies);

    expect(res.status).toBe(403);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toContain('Forbidden');
  });

  // 10. Sales Head cannot access Estimator-only endpoints
  it('should reject Sales Head accessing Estimator-only endpoint with 403', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send(salesHeadCredentials);

    const cookies = loginRes.headers['set-cookie'];

    const res = await request(app)
      .get('/api/test/estimator-only')
      .set('Cookie', cookies);

    expect(res.status).toBe(403);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toContain('Forbidden');
  });

  // 11. Estimator can access Estimator-only endpoints
  it('should allow Estimator to access Estimator-only endpoint', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send(estimatorCredentials);

    const cookies = loginRes.headers['set-cookie'];

    const res = await request(app)
      .get('/api/test/estimator-only')
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Estimator access granted');
  });

  // 12. Sales Head can access Sales Head-only endpoints
  it('should allow Sales Head to access Sales Head-only endpoint', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send(salesHeadCredentials);

    const cookies = loginRes.headers['set-cookie'];

    const res = await request(app)
      .get('/api/test/sales-head-only')
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Sales Head access granted');
  });
});

