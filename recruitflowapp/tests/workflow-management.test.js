const request = require('supertest');
const express = require('express');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const { setupWorkflowRoutes } = require('../server/workflow');
const { MemStorage } = require('../server/storage');

describe('Workflow Management API', () => {
  let app;
  let storage;
  let mockUser;
  let mockCompany;
  let mockJob;
  let mockCandidate;
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

    // Setup test login endpoint
    app.post('/test-login', (req, res) => {
      req.session.user = req.body.user;
      req.session.activeTenantId = req.body.activeTenantId;
      res.json({ success: true });
    });

    // Setup routes
    setupWorkflowRoutes(app);

    // Create test data
    mockCompany = await storage.createCompany({
      name: 'Test Company',
      subdomain: 'testcompany',
      settings: {}
    });

    mockUser = await storage.createUser({
      username: 'testuser@example.com',
      password: 'hashedpassword',
      companyId: mockCompany.id,
      role: 'admin'
    });

    mockJob = await storage.createJob({
      title: 'Software Engineer',
      department: 'Engineering',
      companyId: mockCompany.id,
      status: 'draft',
      type: 'full-time',
      description: 'Test job description',
      applicationLink: 'https://company.com/apply/123'
    });

    mockCandidate = await storage.createCandidate({
      fullName: 'John Doe',
      email: 'john.doe@example.com',
      jobId: mockJob.id,
      companyId: mockCompany.id,
      status: 'applied'
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

  describe('Job Status Transitions', () => {
    describe('GET /api/jobs/:id/status-transitions', () => {
      it('should return allowed transitions for job status', async () => {
        const response = await request(app)
          .get(`/api/jobs/${mockJob.id}/status-transitions`)
          .set('Cookie', sessionCookie);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('currentStatus', 'draft');
        expect(response.body).toHaveProperty('allowedTransitions');
        expect(response.body.allowedTransitions).toContain('active');
        expect(response.body.allowedTransitions).toContain('archived');
        expect(response.body).toHaveProperty('transitionRules');
      });

      it('should require authentication', async () => {
        const response = await request(app)
          .get(`/api/jobs/${mockJob.id}/status-transitions`);

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Unauthorized');
      });

      it('should return 404 for non-existent job', async () => {
        const response = await request(app)
          .get('/api/jobs/99999/status-transitions')
          .set('Cookie', sessionCookie);

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Job not found');
      });
    });

    describe('PATCH /api/jobs/:id/status', () => {
      it('should update job status with valid transition', async () => {
        const response = await request(app)
          .patch(`/api/jobs/${mockJob.id}/status`)
          .set('Cookie', sessionCookie)
          .send({
            status: 'active',
            reason: 'Job posting is ready'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.newStatus).toBe('active');
        expect(response.body.previousStatus).toBe('draft');
        expect(response.body.reason).toBe('Job posting is ready');
      });

      it('should reject invalid status transition', async () => {
        const response = await request(app)
          .patch(`/api/jobs/${mockJob.id}/status`)
          .set('Cookie', sessionCookie)
          .send({
            status: 'closed' // Cannot go from draft to closed directly
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Invalid status transition');
        expect(response.body.allowedTransitions).toContain('active');
        expect(response.body.allowedTransitions).toContain('archived');
      });

      it('should require status field', async () => {
        const response = await request(app)
          .patch(`/api/jobs/${mockJob.id}/status`)
          .set('Cookie', sessionCookie)
          .send({
            reason: 'Missing status'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Status is required');
      });

      it('should handle complete status workflow', async () => {
        // Draft -> Active
        let response = await request(app)
          .patch(`/api/jobs/${mockJob.id}/status`)
          .set('Cookie', sessionCookie)
          .send({ status: 'active' });

        expect(response.status).toBe(200);
        expect(response.body.newStatus).toBe('active');

        // Active -> Paused
        response = await request(app)
          .patch(`/api/jobs/${mockJob.id}/status`)
          .set('Cookie', sessionCookie)
          .send({ status: 'paused' });

        expect(response.status).toBe(200);
        expect(response.body.newStatus).toBe('paused');

        // Paused -> Closed
        response = await request(app)
          .patch(`/api/jobs/${mockJob.id}/status`)
          .set('Cookie', sessionCookie)
          .send({ status: 'closed' });

        expect(response.status).toBe(200);
        expect(response.body.newStatus).toBe('closed');

        // Closed -> Archived
        response = await request(app)
          .patch(`/api/jobs/${mockJob.id}/status`)
          .set('Cookie', sessionCookie)
          .send({ status: 'archived' });

        expect(response.status).toBe(200);
        expect(response.body.newStatus).toBe('archived');
      });

      it('should prevent transitions from archived status', async () => {
        // First archive the job
        await request(app)
          .patch(`/api/jobs/${mockJob.id}/status`)
          .set('Cookie', sessionCookie)
          .send({ status: 'archived' });

        // Try to transition from archived (should fail)
        const response = await request(app)
          .patch(`/api/jobs/${mockJob.id}/status`)
          .set('Cookie', sessionCookie)
          .send({ status: 'active' });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Invalid status transition');
      });
    });
  });

  describe('Candidate Status Transitions', () => {
    describe('GET /api/candidates/:id/status-transitions', () => {
      it('should return allowed transitions for candidate status', async () => {
        const response = await request(app)
          .get(`/api/candidates/${mockCandidate.id}/status-transitions`)
          .set('Cookie', sessionCookie);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('currentStatus', 'applied');
        expect(response.body).toHaveProperty('allowedTransitions');
        expect(response.body.allowedTransitions).toContain('screening');
        expect(response.body.allowedTransitions).toContain('rejected');
        expect(response.body).toHaveProperty('transitionRules');
      });

      it('should require authentication', async () => {
        const response = await request(app)
          .get(`/api/candidates/${mockCandidate.id}/status-transitions`);

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Unauthorized');
      });
    });

    describe('PATCH /api/candidates/:id/status', () => {
      it('should update candidate status with valid transition', async () => {
        const response = await request(app)
          .patch(`/api/candidates/${mockCandidate.id}/status`)
          .set('Cookie', sessionCookie)
          .send({
            status: 'screening',
            reason: 'Initial application review passed',
            notes: 'Strong technical background'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.newStatus).toBe('screening');
        expect(response.body.previousStatus).toBe('applied');
        expect(response.body.reason).toBe('Initial application review passed');
      });

      it('should reject invalid status transition', async () => {
        const response = await request(app)
          .patch(`/api/candidates/${mockCandidate.id}/status`)
          .set('Cookie', sessionCookie)
          .send({
            status: 'hired' // Cannot go from applied to hired directly
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Invalid status transition');
        expect(response.body.allowedTransitions).toContain('screening');
        expect(response.body.allowedTransitions).toContain('rejected');
      });

      it('should handle complete candidate workflow', async () => {
        // Applied -> Screening
        let response = await request(app)
          .patch(`/api/candidates/${mockCandidate.id}/status`)
          .set('Cookie', sessionCookie)
          .send({ status: 'screening' });

        expect(response.status).toBe(200);
        expect(response.body.newStatus).toBe('screening');

        // Screening -> Interview
        response = await request(app)
          .patch(`/api/candidates/${mockCandidate.id}/status`)
          .set('Cookie', sessionCookie)
          .send({ status: 'interview' });

        expect(response.status).toBe(200);
        expect(response.body.newStatus).toBe('interview');

        // Interview -> Offer
        response = await request(app)
          .patch(`/api/candidates/${mockCandidate.id}/status`)
          .set('Cookie', sessionCookie)
          .send({ status: 'offer' });

        expect(response.status).toBe(200);
        expect(response.body.newStatus).toBe('offer');

        // Offer -> Hired
        response = await request(app)
          .patch(`/api/candidates/${mockCandidate.id}/status`)
          .set('Cookie', sessionCookie)
          .send({ status: 'hired' });

        expect(response.status).toBe(200);
        expect(response.body.newStatus).toBe('hired');
      });

      it('should handle rejection workflow', async () => {
        // Applied -> Rejected
        const response = await request(app)
          .patch(`/api/candidates/${mockCandidate.id}/status`)
          .set('Cookie', sessionCookie)
          .send({
            status: 'rejected',
            reason: 'Does not meet minimum requirements',
            notes: 'Lacks required experience in React'
          });

        expect(response.status).toBe(200);
        expect(response.body.newStatus).toBe('rejected');
        expect(response.body.reason).toBe('Does not meet minimum requirements');
      });

      it('should handle on-hold workflow', async () => {
        // First move to screening
        await request(app)
          .patch(`/api/candidates/${mockCandidate.id}/status`)
          .set('Cookie', sessionCookie)
          .send({ status: 'screening' });

        // Screening -> On-hold
        let response = await request(app)
          .patch(`/api/candidates/${mockCandidate.id}/status`)
          .set('Cookie', sessionCookie)
          .send({ status: 'on-hold' });

        expect(response.status).toBe(200);
        expect(response.body.newStatus).toBe('on-hold');

        // On-hold -> Interview
        response = await request(app)
          .patch(`/api/candidates/${mockCandidate.id}/status`)
          .set('Cookie', sessionCookie)
          .send({ status: 'interview' });

        expect(response.status).toBe(200);
        expect(response.body.newStatus).toBe('interview');
      });
    });
  });

  describe('Status History Tracking', () => {
    describe('GET /api/jobs/:id/status-history', () => {
      it('should return job status change history', async () => {
        // Make some status changes
        await request(app)
          .patch(`/api/jobs/${mockJob.id}/status`)
          .set('Cookie', sessionCookie)
          .send({ status: 'active' });

        await request(app)
          .patch(`/api/jobs/${mockJob.id}/status`)
          .set('Cookie', sessionCookie)
          .send({ status: 'closed' });

        const response = await request(app)
          .get(`/api/jobs/${mockJob.id}/status-history`)
          .set('Cookie', sessionCookie);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('jobId', mockJob.id);
        expect(response.body).toHaveProperty('currentStatus', 'closed');
        expect(response.body).toHaveProperty('history');
        expect(Array.isArray(response.body.history)).toBe(true);
      });

      it('should require authentication', async () => {
        const response = await request(app)
          .get(`/api/jobs/${mockJob.id}/status-history`);

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Unauthorized');
      });
    });

    describe('GET /api/candidates/:id/status-history', () => {
      it('should return candidate status change history', async () => {
        // Make some status changes
        await request(app)
          .patch(`/api/candidates/${mockCandidate.id}/status`)
          .set('Cookie', sessionCookie)
          .send({ status: 'screening' });

        await request(app)
          .patch(`/api/candidates/${mockCandidate.id}/status`)
          .set('Cookie', sessionCookie)
          .send({ status: 'interview' });

        const response = await request(app)
          .get(`/api/candidates/${mockCandidate.id}/status-history`)
          .set('Cookie', sessionCookie);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('candidateId', mockCandidate.id);
        expect(response.body).toHaveProperty('currentStatus', 'interview');
        expect(response.body).toHaveProperty('history');
        expect(Array.isArray(response.body.history)).toBe(true);
      });
    });
  });

  describe('Tenant Isolation', () => {
    it('should prevent access to jobs from other companies', async () => {
      // Create second company and job
      const company2 = await storage.createCompany({
        name: 'Other Company',
        subdomain: 'othercompany',
        settings: {}
      });

      const job2 = await storage.createJob({
        title: 'Other Job',
        department: 'Other',
        companyId: company2.id,
        status: 'draft',
        type: 'full-time',
        description: 'Other job',
        applicationLink: 'https://other.com/apply'
      });

      // Try to access other company's job
      const response = await request(app)
        .get(`/api/jobs/${job2.id}/status-transitions`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Job not found');
    });

    it('should prevent access to candidates from other companies', async () => {
      // Create second company and candidate
      const company2 = await storage.createCompany({
        name: 'Other Company',
        subdomain: 'othercompany',
        settings: {}
      });

      const candidate2 = await storage.createCandidate({
        fullName: 'Jane Smith',
        email: 'jane@example.com',
        jobId: null,
        companyId: company2.id,
        status: 'applied'
      });

      // Try to access other company's candidate
      const response = await request(app)
        .get(`/api/candidates/${candidate2.id}/status-transitions`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Candidate not found');
    });
  });

  describe('Workflow Validation Rules', () => {
    it('should enforce job status workflow rules', async () => {
      // Test all invalid transitions for draft status
      const invalidTransitions = ['paused', 'closed'];
      
      for (const status of invalidTransitions) {
        const response = await request(app)
          .patch(`/api/jobs/${mockJob.id}/status`)
          .set('Cookie', sessionCookie)
          .send({ status });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Invalid status transition');
      }
    });

    it('should enforce candidate status workflow rules', async () => {
      // Test all invalid transitions for applied status
      const invalidTransitions = ['interview', 'offer', 'hired', 'on-hold', 'withdrawn', 'archived'];
      
      for (const status of invalidTransitions) {
        const response = await request(app)
          .patch(`/api/candidates/${mockCandidate.id}/status`)
          .set('Cookie', sessionCookie)
          .send({ status });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Invalid status transition');
      }
    });
  });
});