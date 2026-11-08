import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

describe('GET /api/health', () => {
  it('should return 200 and a success response', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'success',
      data: {
        status: 'healthy',
        timestamp: expect.any(String),
        service: 'forgequote-api',
        version: '1.0.0',
      },
    });
  });

  it('should return 404 for unknown endpoints', async () => {
    const response = await request(app).get('/api/unknown-route');

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('status', 'error');
    expect(response.body).toHaveProperty('message');
  });
});

