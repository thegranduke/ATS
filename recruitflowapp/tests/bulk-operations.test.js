const request = require('supertest');
const express = require('express');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const { setupBulkOperationRoutes } = require('../server/bulk-operations');
const { MemStorage } = require('../server/storage');

describe('Bulk Operations API', () => {
  let app;
  let storage;
  let mockUser;
  let mockCompany;
  let mockJobs;
  let mockCandidates;
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
    setupBulkOperationRoutes(app);

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

    // Create test jobs
    mockJobs = [];
    for (let i = 1; i <= 5; i++) {
      const job = await storage.createJob({
        title: `Software Engineer ${i}`,
        department: 'Engineering',
        companyId: mockCompany.id,
        status: 'draft',
        type: 'full-time',
        description: `Test job description ${i}`,
        applicationLink: `https://company.com/apply/${i}`
      });
      mockJobs.push(job);
    }

    // Create test candidates
    mockCandidates = [];
    for (let i = 1; i <= 5; i++) {
      const candidate = await storage.createCandidate({
        fullName: `John Doe ${i}`,
        email: `john.doe${i}@example.com`,
        jobId: mockJobs[0].id,
        companyId: mockCompany.id,
        status: 'applied'
      });
      mockCandidates.push(candidate);
    }

    // Create authenticated session
    const loginResponse = await request(app)
      .post('/test-login')
      .send({
        user: mockUser,
        activeTenantId: mockCompany.id
      });

    sessionCookie = loginResponse.headers['set-cookie'];
  });

  describe('Bulk Job Operations', () => {
    describe('POST /api/jobs/bulk', () => {
      it('should successfully archive multiple jobs', async () => {
        const jobIds = [mockJobs[0].id, mockJobs[1].id, mockJobs[2].id];
        
        const response = await request(app)
          .post('/api/jobs/bulk')
          .set('Cookie', sessionCookie)
          .send({
            jobIds,
            action: 'archive',
            reason: 'End of hiring cycle'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.summary.total).toBe(3);
        expect(response.body.summary.successful).toBe(3);
        expect(response.body.summary.failed).toBe(0);
        expect(response.body.summary.action).toBe('archive');
        expect(response.body.rollbackAvailable).toBe(true);
        expect(response.body.operationId).toBeDefined();
        expect(response.body.reason).toBe('End of hiring cycle');

        // Verify jobs were actually archived
        for (const jobId of jobIds) {
          const job = await storage.getJobById(jobId);
          expect(job.status).toBe('archived');
        }
      });

      it('should successfully activate multiple jobs', async () => {
        const jobIds = [mockJobs[0].id, mockJobs[1].id];
        
        const response = await request(app)
          .post('/api/jobs/bulk')
          .set('Cookie', sessionCookie)
          .send({
            jobIds,
            action: 'activate'
          });

        expect(response.status).toBe(200);
        expect(response.body.summary.successful).toBe(2);
        expect(response.body.summary.action).toBe('activate');

        // Verify jobs were activated
        for (const jobId of jobIds) {
          const job = await storage.getJobById(jobId);
          expect(job.status).toBe('active');
        }
      });

      it('should successfully delete multiple jobs', async () => {
        const jobIds = [mockJobs[3].id, mockJobs[4].id];
        
        const response = await request(app)
          .post('/api/jobs/bulk')
          .set('Cookie', sessionCookie)
          .send({
            jobIds,
            action: 'delete',
            reason: 'Positions cancelled'
          });

        expect(response.status).toBe(200);
        expect(response.body.summary.successful).toBe(2);
        expect(response.body.summary.action).toBe('delete');

        // Verify jobs were deleted
        for (const jobId of jobIds) {
          const job = await storage.getJobById(jobId);
          expect(job).toBeUndefined();
        }
      });

      it('should validate job ownership for tenant isolation', async () => {
        // Create job in different company
        const company2 = await storage.createCompany({
          name: 'Other Company',
          subdomain: 'othercompany',
          settings: {}
        });

        const otherJob = await storage.createJob({
          title: 'Other Job',
          department: 'Other',
          companyId: company2.id,
          status: 'draft',
          type: 'full-time',
          description: 'Other job',
          applicationLink: 'https://other.com/apply'
        });

        const response = await request(app)
          .post('/api/jobs/bulk')
          .set('Cookie', sessionCookie)
          .send({
            jobIds: [mockJobs[0].id, otherJob.id],
            action: 'archive'
          });

        expect(response.status).toBe(404);
        expect(response.body.error).toContain('not found or access denied');
      });

      it('should validate request data', async () => {
        // Missing jobIds
        let response = await request(app)
          .post('/api/jobs/bulk')
          .set('Cookie', sessionCookie)
          .send({
            action: 'archive'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Invalid bulk operation data');

        // Invalid action
        response = await request(app)
          .post('/api/jobs/bulk')
          .set('Cookie', sessionCookie)
          .send({
            jobIds: [mockJobs[0].id],
            action: 'invalid-action'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Invalid bulk operation data');

        // Too many jobs (over limit of 100)
        const tooManyIds = Array.from({ length: 101 }, (_, i) => i + 1);
        response = await request(app)
          .post('/api/jobs/bulk')
          .set('Cookie', sessionCookie)
          .send({
            jobIds: tooManyIds,
            action: 'archive'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Invalid bulk operation data');
      });

      it('should require authentication', async () => {
        const response = await request(app)
          .post('/api/jobs/bulk')
          .send({
            jobIds: [mockJobs[0].id],
            action: 'archive'
          });

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Unauthorized');
      });
    });
  });

  describe('Bulk Candidate Operations', () => {
    describe('POST /api/candidates/bulk', () => {
      it('should successfully reject multiple candidates', async () => {
        const candidateIds = [mockCandidates[0].id, mockCandidates[1].id];
        
        const response = await request(app)
          .post('/api/candidates/bulk')
          .set('Cookie', sessionCookie)
          .send({
            candidateIds,
            action: 'reject',
            reason: 'Position filled',
            notes: 'Thank you for your interest'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.summary.total).toBe(2);
        expect(response.body.summary.successful).toBe(2);
        expect(response.body.summary.action).toBe('reject');
        expect(response.body.rollbackAvailable).toBe(true);

        // Verify candidates were rejected with notes
        for (const candidateId of candidateIds) {
          const candidate = await storage.getCandidateById(candidateId);
          expect(candidate.status).toBe('rejected');
          expect(candidate.notes).toContain('Bulk rejected');
          expect(candidate.notes).toContain('Thank you for your interest');
        }
      });

      it('should successfully move candidates to screening', async () => {
        const candidateIds = [mockCandidates[2].id, mockCandidates[3].id];
        
        const response = await request(app)
          .post('/api/candidates/bulk')
          .set('Cookie', sessionCookie)
          .send({
            candidateIds,
            action: 'move-to-screening'
          });

        expect(response.status).toBe(200);
        expect(response.body.summary.successful).toBe(2);
        expect(response.body.summary.action).toBe('move-to-screening');

        // Verify candidates moved to screening
        for (const candidateId of candidateIds) {
          const candidate = await storage.getCandidateById(candidateId);
          expect(candidate.status).toBe('screening');
        }
      });

      it('should successfully move candidates to interview', async () => {
        const candidateIds = [mockCandidates[4].id];
        
        const response = await request(app)
          .post('/api/candidates/bulk')
          .set('Cookie', sessionCookie)
          .send({
            candidateIds,
            action: 'move-to-interview'
          });

        expect(response.status).toBe(200);
        expect(response.body.summary.successful).toBe(1);

        const candidate = await storage.getCandidateById(candidateIds[0]);
        expect(candidate.status).toBe('interview');
      });

      it('should handle mixed success and failure results', async () => {
        // Delete one candidate to cause a failure
        await storage.deleteCandidate(mockCandidates[1].id);
        
        const candidateIds = [mockCandidates[0].id, mockCandidates[1].id];
        
        const response = await request(app)
          .post('/api/candidates/bulk')
          .set('Cookie', sessionCookie)
          .send({
            candidateIds,
            action: 'archive'
          });

        expect(response.status).toBe(200);
        expect(response.body.summary.total).toBe(2);
        expect(response.body.summary.successful).toBe(1);
        expect(response.body.summary.failed).toBe(1);
        
        // Check individual results
        const successResult = response.body.results.find(r => r.success);
        const failResult = response.body.results.find(r => !r.success);
        
        expect(successResult).toBeDefined();
        expect(failResult).toBeDefined();
        expect(failResult.error).toBeDefined();
      });
    });
  });

  describe('Rollback Operations', () => {
    describe('POST /api/bulk-operations/:operationId/rollback', () => {
      it('should successfully rollback job archive operation', async () => {
        // First perform a bulk operation
        const jobIds = [mockJobs[0].id, mockJobs[1].id];
        
        const bulkResponse = await request(app)
          .post('/api/jobs/bulk')
          .set('Cookie', sessionCookie)
          .send({
            jobIds,
            action: 'archive'
          });

        const operationId = bulkResponse.body.operationId;

        // Verify jobs are archived
        for (const jobId of jobIds) {
          const job = await storage.getJobById(jobId);
          expect(job.status).toBe('archived');
        }

        // Rollback the operation
        const rollbackResponse = await request(app)
          .post(`/api/bulk-operations/${operationId}/rollback`)
          .set('Cookie', sessionCookie)
          .send({
            confirm: true
          });

        expect(rollbackResponse.status).toBe(200);
        expect(rollbackResponse.body.success).toBe(true);
        expect(rollbackResponse.body.operationId).toBe(operationId);

        // Verify jobs are back to original status
        for (const jobId of jobIds) {
          const job = await storage.getJobById(jobId);
          expect(job.status).toBe('draft'); // Original status
        }
      });

      it('should successfully rollback candidate status changes', async () => {
        const candidateIds = [mockCandidates[0].id];
        
        // Perform bulk operation
        const bulkResponse = await request(app)
          .post('/api/candidates/bulk')
          .set('Cookie', sessionCookie)
          .send({
            candidateIds,
            action: 'move-to-screening'
          });

        const operationId = bulkResponse.body.operationId;

        // Verify status changed
        let candidate = await storage.getCandidateById(candidateIds[0]);
        expect(candidate.status).toBe('screening');

        // Rollback
        await request(app)
          .post(`/api/bulk-operations/${operationId}/rollback`)
          .set('Cookie', sessionCookie)
          .send({ confirm: true });

        // Verify rollback
        candidate = await storage.getCandidateById(candidateIds[0]);
        expect(candidate.status).toBe('applied'); // Original status
      });

      it('should require confirmation for rollback', async () => {
        const bulkResponse = await request(app)
          .post('/api/jobs/bulk')
          .set('Cookie', sessionCookie)
          .send({
            jobIds: [mockJobs[0].id],
            action: 'archive'
          });

        const rollbackResponse = await request(app)
          .post(`/api/bulk-operations/${bulkResponse.body.operationId}/rollback`)
          .set('Cookie', sessionCookie)
          .send({}); // No confirmation

        expect(rollbackResponse.status).toBe(400);
        expect(rollbackResponse.body.error).toBe('Rollback confirmation required');
      });

      it('should return 400 for non-existent operation', async () => {
        const response = await request(app)
          .post('/api/bulk-operations/non-existent-id/rollback')
          .set('Cookie', sessionCookie)
          .send({ confirm: true });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Failed to rollback operation');
      });
    });
  });

  describe('Bulk Operation History', () => {
    describe('GET /api/bulk-operations', () => {
      it('should return bulk operation history', async () => {
        // Perform some operations
        await request(app)
          .post('/api/jobs/bulk')
          .set('Cookie', sessionCookie)
          .send({
            jobIds: [mockJobs[0].id],
            action: 'archive'
          });

        await request(app)
          .post('/api/candidates/bulk')
          .set('Cookie', sessionCookie)
          .send({
            candidateIds: [mockCandidates[0].id],
            action: 'reject'
          });

        const response = await request(app)
          .get('/api/bulk-operations')
          .set('Cookie', sessionCookie);

        expect(response.status).toBe(200);
        expect(response.body.operations).toBeDefined();
        expect(Array.isArray(response.body.operations)).toBe(true);
        expect(response.body.operations.length).toBeGreaterThan(0);
        expect(response.body.total).toBeGreaterThan(0);

        // Check operation structure
        const operation = response.body.operations[0];
        expect(operation).toHaveProperty('id');
        expect(operation).toHaveProperty('action');
        expect(operation).toHaveProperty('entityType');
        expect(operation).toHaveProperty('timestamp');
        expect(operation).toHaveProperty('affectedCount');
        expect(operation).toHaveProperty('rollbackAvailable');
      });

      it('should support pagination', async () => {
        const response = await request(app)
          .get('/api/bulk-operations?limit=1&offset=0')
          .set('Cookie', sessionCookie);

        expect(response.status).toBe(200);
        expect(response.body.operations.length).toBeLessThanOrEqual(1);
      });

      it('should require authentication', async () => {
        const response = await request(app)
          .get('/api/bulk-operations');

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Unauthorized');
      });
    });

    describe('GET /api/bulk-operations/:operationId', () => {
      it('should return specific operation details', async () => {
        const bulkResponse = await request(app)
          .post('/api/jobs/bulk')
          .set('Cookie', sessionCookie)
          .send({
            jobIds: [mockJobs[0].id, mockJobs[1].id],
            action: 'archive'
          });

        const operationId = bulkResponse.body.operationId;

        const response = await request(app)
          .get(`/api/bulk-operations/${operationId}`)
          .set('Cookie', sessionCookie);

        expect(response.status).toBe(200);
        expect(response.body.id).toBe(operationId);
        expect(response.body.action).toBe('archive');
        expect(response.body.entityType).toBe('job');
        expect(response.body.affectedCount).toBe(2);
        expect(response.body.rollbackAvailable).toBe(true);
        expect(response.body.originalData).toBeDefined();
        expect(response.body.affectedIds).toEqual([mockJobs[0].id, mockJobs[1].id]);
      });

      it('should return 404 for non-existent operation', async () => {
        const response = await request(app)
          .get('/api/bulk-operations/non-existent-id')
          .set('Cookie', sessionCookie);

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Operation not found');
      });
    });
  });

  describe('Tenant Isolation', () => {
    it('should prevent access to other company operations', async () => {
      // Create second company and user
      const company2 = await storage.createCompany({
        name: 'Other Company',
        subdomain: 'othercompany',
        settings: {}
      });

      const user2 = await storage.createUser({
        username: 'user2@other.com',
        password: 'hashedpassword',
        companyId: company2.id,
        role: 'admin'
      });

      // Login as second user
      await request(app)
        .post('/test-login')
        .send({
          user: user2,
          activeTenantId: company2.id
        });

      // Should not see operations from first company
      const response = await request(app)
        .get('/api/bulk-operations')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.operations.length).toBe(0);
    });
  });

  describe('Performance and Limits', () => {
    it('should enforce maximum batch size limits', async () => {
      const tooManyIds = Array.from({ length: 101 }, (_, i) => i + 1);
      
      const response = await request(app)
        .post('/api/jobs/bulk')
        .set('Cookie', sessionCookie)
        .send({
          jobIds: tooManyIds,
          action: 'archive'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid bulk operation data');
    });

    it('should handle empty job ID arrays', async () => {
      const response = await request(app)
        .post('/api/jobs/bulk')
        .set('Cookie', sessionCookie)
        .send({
          jobIds: [],
          action: 'archive'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid bulk operation data');
    });
  });
});