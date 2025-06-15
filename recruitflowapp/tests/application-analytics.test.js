const request = require('supertest');
const express = require('express');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const { setupAnalyticsRoutes } = require('../server/analytics');
const { MemStorage } = require('../server/storage');

describe('Application Form Analytics API', () => {
  let app;
  let storage;
  let mockUser;
  let mockCompany;
  let mockJob;
  let sessionCookie;

  beforeEach(async () => {
    // Create Express app
    app = express();
    app.use(express.json());
    
    // Setup session middleware
    app.use(session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
      store: new MemoryStore({ checkPeriod: 86400000 }),
      cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
    }));

    // Create storage instance
    storage = new MemStorage();
    
    // Replace the storage module export
    const storageModule = require('../server/storage');
    storageModule.storage = storage;

    // Setup mock authentication middleware
    app.use((req, res, next) => {
      if (req.session && req.session.user) {
        req.user = req.session.user;
        req.isAuthenticated = () => true;
        req.activeTenantId = req.session.activeTenantId || req.user.companyId;
      } else {
        req.isAuthenticated = () => false;
      }
      next();
    });

    // Setup test login endpoint for session creation
    app.post('/test-login', (req, res) => {
      req.session.user = req.body.user;
      req.session.activeTenantId = req.body.activeTenantId;
      res.json({ success: true });
    });

    // Setup routes
    setupAnalyticsRoutes(app);

    // Create test company, user, and job
    mockCompany = await storage.createCompany({
      name: 'Test Company',
      subdomain: 'testcompany',
      settings: {}
    });

    mockUser = await storage.createUser({
      username: 'testuser',
      password: 'hashedpassword',
      companyId: mockCompany.id,
      role: 'admin'
    });

    mockJob = await storage.createJob({
      title: 'Software Engineer',
      department: 'Engineering',
      companyId: mockCompany.id,
      status: 'active',
      type: 'full-time',
      description: 'Test job description',
      applicationLink: 'https://company.com/apply/123'
    });

    // Create authenticated session
    const loginResponse = await request(app)
      .post('/test-login')
      .send({
        user: mockUser,
        activeTenantId: mockCompany.id
      });

    sessionCookie = loginResponse.headers['set-cookie'];
  });

  describe('POST /api/analytics/forms/start', () => {
    it('should track form start successfully', async () => {
      const formData = {
        jobId: mockJob.id,
        sessionId: 'session-123',
        source: 'linkedin',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ipAddress: '192.168.1.1',
        referrer: 'https://linkedin.com/jobs'
      };

      const response = await request(app)
        .post('/api/analytics/forms/start')
        .send(formData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.sessionId).toBe('session-123');
      expect(response.body.trackingId).toBeDefined();
    });

    it('should require jobId and sessionId', async () => {
      const response = await request(app)
        .post('/api/analytics/forms/start')
        .send({
          source: 'linkedin'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Job ID and session ID are required');
    });

    it('should return 404 for non-existent job', async () => {
      const response = await request(app)
        .post('/api/analytics/forms/start')
        .send({
          jobId: 99999,
          sessionId: 'session-123'
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Job not found');
    });

    it('should detect device type from user agent', async () => {
      const mobileUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15';
      
      const response = await request(app)
        .post('/api/analytics/forms/start')
        .send({
          jobId: mockJob.id,
          sessionId: 'mobile-session',
          userAgent: mobileUserAgent
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/analytics/forms/complete', () => {
    it('should track form completion successfully', async () => {
      // First start a form
      await request(app)
        .post('/api/analytics/forms/start')
        .send({
          jobId: mockJob.id,
          sessionId: 'completion-session',
          source: 'direct'
        });

      const response = await request(app)
        .post('/api/analytics/forms/complete')
        .send({
          sessionId: 'completion-session',
          completionTime: new Date().toISOString(),
          fieldsCompleted: ['name', 'email', 'phone', 'resume']
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.analytics).toBeDefined();
    });

    it('should require sessionId', async () => {
      const response = await request(app)
        .post('/api/analytics/forms/complete')
        .send({
          completionTime: new Date().toISOString()
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Session ID is required');
    });
  });

  describe('POST /api/analytics/forms/submit', () => {
    it('should track form submission successfully', async () => {
      // First start a form
      await request(app)
        .post('/api/analytics/forms/start')
        .send({
          jobId: mockJob.id,
          sessionId: 'submit-session',
          source: 'company-website'
        });

      // Create a candidate
      const candidate = await storage.createCandidate({
        fullName: 'John Doe',
        email: 'john.doe@example.com',
        jobId: mockJob.id,
        companyId: mockCompany.id,
        status: 'applied'
      });

      const response = await request(app)
        .post('/api/analytics/forms/submit')
        .send({
          sessionId: 'submit-session',
          candidateId: candidate.id
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.analytics).toBeDefined();
    });

    it('should require sessionId', async () => {
      const response = await request(app)
        .post('/api/analytics/forms/submit')
        .send({
          candidateId: 123
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Session ID is required');
    });
  });

  describe('GET /api/analytics/job/:jobId/forms', () => {
    it('should return job form analytics', async () => {
      // Create some analytics data
      await request(app)
        .post('/api/analytics/forms/start')
        .send({
          jobId: mockJob.id,
          sessionId: 'analytics-session-1',
          source: 'linkedin'
        });

      await request(app)
        .post('/api/analytics/forms/start')
        .send({
          jobId: mockJob.id,
          sessionId: 'analytics-session-2',
          source: 'indeed'
        });

      const response = await request(app)
        .get(`/api/analytics/job/${mockJob.id}/forms`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get(`/api/analytics/job/${mockJob.id}/forms`);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    });

    it('should return 404 for non-existent job', async () => {
      const response = await request(app)
        .get('/api/analytics/job/99999/forms')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Job not found');
    });

    it('should enforce tenant isolation', async () => {
      // Create another company and job
      const company2 = await storage.createCompany({
        name: 'Other Company',
        subdomain: 'othercompany',
        settings: {}
      });

      const job2 = await storage.createJob({
        title: 'Other Job',
        department: 'Other',
        companyId: company2.id,
        status: 'active',
        type: 'full-time',
        description: 'Other job',
        applicationLink: 'https://other.com/apply'
      });

      // Try to access other company's job analytics
      const response = await request(app)
        .get(`/api/analytics/job/${job2.id}/forms`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Job not found');
    });
  });

  describe('GET /api/analytics/conversions', () => {
    it('should return conversion analytics for company', async () => {
      // Create analytics data with different stages
      await request(app)
        .post('/api/analytics/forms/start')
        .send({
          jobId: mockJob.id,
          sessionId: 'conversion-1',
          source: 'linkedin'
        });

      await request(app)
        .post('/api/analytics/forms/complete')
        .send({
          sessionId: 'conversion-1'
        });

      await request(app)
        .post('/api/analytics/forms/submit')
        .send({
          sessionId: 'conversion-1'
        });

      const response = await request(app)
        .get('/api/analytics/conversions')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalStarted');
      expect(response.body).toHaveProperty('totalCompleted');
      expect(response.body).toHaveProperty('totalConverted');
      expect(response.body).toHaveProperty('conversionRate');
      expect(response.body).toHaveProperty('completionRate');
    });

    it('should support date range filtering', async () => {
      const startDate = new Date('2024-01-01').toISOString();
      const endDate = new Date('2024-12-31').toISOString();

      const response = await request(app)
        .get('/api/analytics/conversions')
        .query({ startDate, endDate })
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalStarted');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/analytics/conversions');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    });
  });

  describe('GET /api/analytics/sources', () => {
    it('should return source performance analytics', async () => {
      // Create analytics data from different sources
      const sources = ['linkedin', 'indeed', 'company-website', 'referral'];
      
      for (let i = 0; i < sources.length; i++) {
        await request(app)
          .post('/api/analytics/forms/start')
          .send({
            jobId: mockJob.id,
            sessionId: `source-session-${i}`,
            source: sources[i]
          });

        if (i % 2 === 0) {
          await request(app)
            .post('/api/analytics/forms/complete')
            .send({
              sessionId: `source-session-${i}`
            });
        }

        if (i === 0) {
          await request(app)
            .post('/api/analytics/forms/submit')
            .send({
              sessionId: `source-session-${i}`
            });
        }
      }

      const response = await request(app)
        .get('/api/analytics/sources')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      const sourceData = response.body[0];
      expect(sourceData).toHaveProperty('source');
      expect(sourceData).toHaveProperty('totalStarted');
      expect(sourceData).toHaveProperty('totalCompleted');
      expect(sourceData).toHaveProperty('totalSubmitted');
      expect(sourceData).toHaveProperty('conversionRate');
      expect(sourceData).toHaveProperty('completionRate');
    });

    it('should support date range filtering', async () => {
      const startDate = new Date('2024-01-01').toISOString();
      const endDate = new Date('2024-12-31').toISOString();

      const response = await request(app)
        .get('/api/analytics/sources')
        .query({ startDate, endDate })
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/analytics/sources');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    });
  });

  describe('GET /api/analytics/devices', () => {
    it('should return device and browser analytics', async () => {
      // Create analytics data with different user agents
      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1',
        'Mozilla/5.0 (iPad; CPU OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0'
      ];

      for (let i = 0; i < userAgents.length; i++) {
        await request(app)
          .post('/api/analytics/forms/start')
          .send({
            jobId: mockJob.id,
            sessionId: `device-session-${i}`,
            source: 'direct',
            userAgent: userAgents[i]
          });
      }

      const response = await request(app)
        .get('/api/analytics/devices')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('devices');
      expect(response.body).toHaveProperty('browsers');
      expect(Array.isArray(response.body.devices)).toBe(true);
      expect(Array.isArray(response.body.browsers)).toBe(true);

      if (response.body.devices.length > 0) {
        const deviceData = response.body.devices[0];
        expect(deviceData).toHaveProperty('device');
        expect(deviceData).toHaveProperty('count');
        expect(deviceData).toHaveProperty('percentage');
      }

      if (response.body.browsers.length > 0) {
        const browserData = response.body.browsers[0];
        expect(browserData).toHaveProperty('browser');
        expect(browserData).toHaveProperty('count');
        expect(browserData).toHaveProperty('percentage');
      }
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/analytics/devices');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    });
  });

  describe('Analytics data processing', () => {
    it('should correctly calculate conversion rates', async () => {
      // Create a complete funnel: start -> complete -> submit
      await request(app)
        .post('/api/analytics/forms/start')
        .send({
          jobId: mockJob.id,
          sessionId: 'funnel-1',
          source: 'test'
        });

      await request(app)
        .post('/api/analytics/forms/complete')
        .send({
          sessionId: 'funnel-1'
        });

      await request(app)
        .post('/api/analytics/forms/submit')
        .send({
          sessionId: 'funnel-1'
        });

      // Create a partial funnel: start -> complete (no submit)
      await request(app)
        .post('/api/analytics/forms/start')
        .send({
          jobId: mockJob.id,
          sessionId: 'funnel-2',
          source: 'test'
        });

      await request(app)
        .post('/api/analytics/forms/complete')
        .send({
          sessionId: 'funnel-2'
        });

      // Create abandoned funnel: start only
      await request(app)
        .post('/api/analytics/forms/start')
        .send({
          jobId: mockJob.id,
          sessionId: 'funnel-3',
          source: 'test'
        });

      const response = await request(app)
        .get('/api/analytics/sources')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      
      const testSource = response.body.find(s => s.source === 'test');
      expect(testSource).toBeDefined();
      expect(testSource.totalStarted).toBe(3);
      expect(testSource.totalCompleted).toBe(2);
      expect(testSource.totalSubmitted).toBe(1);
      expect(testSource.conversionRate).toBe(33); // 1/3 * 100 = 33%
      expect(testSource.completionRate).toBe(67); // 2/3 * 100 = 67%
    });

    it('should handle empty analytics data gracefully', async () => {
      const response = await request(app)
        .get('/api/analytics/conversions')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.totalStarted).toBe(0);
      expect(response.body.totalCompleted).toBe(0);
      expect(response.body.totalConverted).toBe(0);
      expect(response.body.conversionRate).toBe(0);
      expect(response.body.completionRate).toBe(0);
    });
  });

  describe('Tenant isolation', () => {
    it('should only show analytics from user\'s company', async () => {
      // Create second company
      const company2 = await storage.createCompany({
        name: 'Other Company',
        subdomain: 'othercompany',
        settings: {}
      });

      const job2 = await storage.createJob({
        title: 'Other Job',
        department: 'Other',
        companyId: company2.id,
        status: 'active',
        type: 'full-time',
        description: 'Other job',
        applicationLink: 'https://other.com/apply'
      });

      // Create analytics for both companies
      await request(app)
        .post('/api/analytics/forms/start')
        .send({
          jobId: mockJob.id,
          sessionId: 'company1-session',
          source: 'company1-source'
        });

      await request(app)
        .post('/api/analytics/forms/start')
        .send({
          jobId: job2.id,
          sessionId: 'company2-session',
          source: 'company2-source'
        });

      // Should only see analytics from user's company
      const response = await request(app)
        .get('/api/analytics/sources')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0].source).toBe('company1-source');
    });
  });
});