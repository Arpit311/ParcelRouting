const request = require('supertest');
const Server = require('../src/server');

describe('API Integration Tests', () => {
  let app;
  let server;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    server = new Server();
    app = server.getApp();
    server.setupMiddleware();
    server.setupRoutes();
  });

  describe('GET /api/health', () => {
    test('should return healthy status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.status).toBe('healthy');
      expect(response.body.timestamp).toBeDefined();
    });

    test('should not be rate limited', async () => {
      for (let i = 0; i < 5; i += 1) {
        await request(app).get('/api/health').expect(200);
      }
    });
  });

  describe('GET /api/rules', () => {
    test('should return available rules', async () => {
      const response = await request(app)
        .get('/api/rules')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.rules)).toBe(true);
      expect(response.body.rules.length).toBeGreaterThan(0);
    });

    test('should return rule metadata', async () => {
      const response = await request(app)
        .get('/api/rules')
        .expect(200);

      const rule = response.body.rules[0];
      expect(rule).toHaveProperty('id');
      expect(rule).toHaveProperty('name');
      expect(rule).toHaveProperty('description');
      expect(rule).toHaveProperty('priority');
    });
  });

  describe('POST /api/route', () => {
    test('should route a valid parcel', async () => {
      const parcel = {
        weight: 5,
        value: 100,
      };

      const response = await request(app)
        .post('/api/route')
        .send(parcel)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.decision).toBeDefined();
      expect(response.body.decision.department).toBeDefined();
      expect(response.body.decision.requiresApproval).toBeDefined();
      expect(response.body.requestId).toBeDefined();
    });

    test('should reject invalid parcel (missing weight)', async () => {
      const parcel = { value: 100 };

      const response = await request(app)
        .post('/api/route')
        .send(parcel)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    test('should reject invalid parcel (negative weight)', async () => {
      const parcel = {
        weight: -5,
        value: 100,
      };

      const response = await request(app)
        .post('/api/route')
        .send(parcel)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should reject parcel with excessive weight', async () => {
      const parcel = {
        weight: 1001,
        value: 100,
      };

      const response = await request(app)
        .post('/api/route')
        .send(parcel)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should handle optional fields', async () => {
      const parcel = {
        weight: 5,
        value: 100,
        destinationCountry: 'NL',
        recipientName: 'John Doe',
      };

      const response = await request(app)
        .post('/api/route')
        .send(parcel)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should sanitize input', async () => {
      const parcel = {
        weight: 5,
        value: 100,
        recipientName: 'John <script>alert("xss")</script> Doe',
      };

      const response = await request(app)
        .post('/api/route')
        .send(parcel)
        .expect(200);

      expect(response.body.success).toBe(true);
      // Name should be sanitized
      expect(response.body.parcel.recipientName).not.toContain('<script>');
    });

    test('should include request ID for tracking', async () => {
      const parcel = {
        weight: 5,
        value: 100,
      };

      const response = await request(app)
        .post('/api/route')
        .send(parcel)
        .expect(200);

      expect(response.body.requestId).toBeDefined();
      // UUID format check
      expect(response.body.requestId).toMatch(/^[0-9a-f-]+$/i);
    });
  });

  describe('POST /api/route-batch', () => {
    test('should route multiple parcels', async () => {
      const batch = {
        parcels: [
          { weight: 0.5, value: 100 },
          { weight: 5, value: 100 },
          { weight: 15, value: 100 },
        ],
      };

      const response = await request(app)
        .post('/api/route-batch')
        .send(batch)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.result.totalCount).toBe(3);
      expect(response.body.result.successCount).toBe(3);
      expect(response.body.result.failureCount).toBe(0);
    });

    test('should reject empty batch', async () => {
      const batch = { parcels: [] };

      const response = await request(app)
        .post('/api/route-batch')
        .send(batch)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should handle mixed valid and invalid parcels', async () => {
      const batch = {
        parcels: [
          { weight: 5, value: 100 },
          { weight: -5, value: 100 },
          { weight: 15, value: 100 },
        ],
      };

      const response = await request(app)
        .post('/api/route-batch')
        .send(batch)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.result.successCount).toBe(2);
      expect(response.body.result.failureCount).toBe(1);
    });

    test('should return department counts', async () => {
      const batch = {
        parcels: [
          { weight: 0.5, value: 100 },
          { weight: 0.3, value: 100 },
          { weight: 5, value: 100 },
          { weight: 15, value: 100 },
        ],
      };

      const response = await request(app)
        .post('/api/route-batch')
        .send(batch)
        .expect(200);

      expect(response.body.result.departmentCounts.Mail).toBe(2);
      expect(response.body.result.departmentCounts.Regular).toBe(1);
      expect(response.body.result.departmentCounts.Heavy).toBe(1);
    });

    test('should include processing time', async () => {
      const batch = {
        parcels: [{ weight: 5, value: 100 }],
      };

      const response = await request(app)
        .post('/api/route-batch')
        .send(batch)
        .expect(200);

      expect(response.body.result.processingTimeMs).toBeDefined();
      expect(response.body.result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('POST /api/upload', () => {
    test('should return upload endpoint information', async () => {
      const response = await request(app)
        .post('/api/upload')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.hint).toBeDefined();
    });

    test('should route parcels from an uploaded JSON file', async () => {
      const fileBuffer = Buffer.from(JSON.stringify({
        parcels: [
          { weight: 0.5, value: 100, destinationCountry: 'NL' },
          { weight: 15, value: 50, destinationCountry: 'DE' },
        ],
      }));

      const response = await request(app)
        .post('/api/upload?format=json')
        .attach('file', fileBuffer, 'parcels.json')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.result).toBeDefined();
      expect(response.body.result.totalCount).toBe(2);
      expect(response.body.result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GET /api/orders-summary', () => {
    test('should return order summary after routing activity', async () => {
      await request(app)
        .post('/api/route')
        .send({ weight: 2, value: 50, destinationCountry: 'FR' })
        .expect(200);

      const response = await request(app)
        .get('/api/orders-summary')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.summary).toBeDefined();
      expect(response.body.summary.totalRequests).toBeGreaterThanOrEqual(1);
      expect(response.body.summary.lastParcel || response.body.summary.lastBatch).toBeDefined();
    });
  });

  describe('GET /api/stats', () => {
    test('should return system statistics', async () => {
      const response = await request(app)
        .get('/api/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.stats).toBeDefined();
      expect(response.body.stats.systemStatus).toBe('operational');
      expect(Array.isArray(response.body.stats.departments)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should return 404 for non-existent endpoint', async () => {
      const response = await request(app)
        .get('/api/non-existent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });

    test('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/route')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should validate content type', async () => {
      const response = await request(app)
        .post('/api/route')
        .set('Content-Type', 'text/plain')
        .send('weight=5&value=100');

      // Depending on implementation, might be 400 or parsed differently
      expect([400, 200]).toContain(response.status);
    });
  });

  describe('Security Headers', () => {
    test('should include security headers', async () => {
      const response = await request(app)
        .get('/api/health');

      // Helmet should add these headers
      expect(response.headers['x-content-type-options']).toBeDefined();
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['strict-transport-security']).toBeDefined();
    });
  });

  describe('Response Structure', () => {
    test('should have consistent response format', async () => {
      const response = await request(app)
        .post('/api/route')
        .send({ weight: 5, value: 100})
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('requestId');
      expect(typeof response.body.success).toBe('boolean');
    });
  });
});
