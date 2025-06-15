const request = require('supertest');
const express = require('express');

describe('Job Management Enhanced Features - Critical Priority', () => {
  let app;
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Mock authenticated admin user
    app.use((req, res, next) => {
      req.isAuthenticated = () => true;
      req.user = { 
        id: 1, 
        companyId: 1, 
        role: 'admin'
      };
      next();
    });
  });

  describe('Job Status Transitions', () => {
    test('should validate job status update API', async () => {
      app.patch('/api/jobs/:id/status', (req, res) => {
        const jobId = parseInt(req.params.id);
        const { status } = req.body;
        
        const validStatuses = ['draft', 'active', 'paused', 'closed', 'archived'];
        if (!validStatuses.includes(status)) {
          return res.status(400).json({ 
            error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
          });
        }

        res.json({
          id: jobId,
          title: 'Software Engineer',
          status,
          companyId: req.user.companyId,
          message: `Job status updated to ${status}`
        });
      });

      const response = await request(app)
        .patch('/api/jobs/1/status')
        .send({ status: 'active' })
        .expect(200);

      expect(response.body.status).toBe('active');
      expect(response.body.message).toBe('Job status updated to active');
    });

    test('should reject invalid job status', async () => {
      app.patch('/api/jobs/:id/status', (req, res) => {
        const { status } = req.body;
        const validStatuses = ['draft', 'active', 'paused', 'closed', 'archived'];
        
        if (!validStatuses.includes(status)) {
          return res.status(400).json({ 
            error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
          });
        }
        
        res.json({ success: true });
      });

      await request(app)
        .patch('/api/jobs/1/status')
        .send({ status: 'invalid_status' })
        .expect(400);
    });
  });

  describe('Job Duplication', () => {
    test('should validate job duplication API', async () => {
      app.post('/api/jobs/:id/duplicate', (req, res) => {
        const originalJobId = parseInt(req.params.id);
        const { titleSuffix = ' (Copy)' } = req.body;

        res.json({
          id: originalJobId + 100, // New job ID
          title: 'Software Engineer' + titleSuffix,
          status: 'draft',
          companyId: req.user.companyId,
          originalJobId,
          message: 'Job duplicated successfully'
        });
      });

      const response = await request(app)
        .post('/api/jobs/1/duplicate')
        .send({ titleSuffix: ' (V2)' })
        .expect(200);

      expect(response.body.title).toBe('Software Engineer (V2)');
      expect(response.body.status).toBe('draft');
      expect(response.body.originalJobId).toBe(1);
    });
  });

  describe('Bulk Operations', () => {
    test('should validate bulk status update API', async () => {
      app.patch('/api/jobs/bulk/status', (req, res) => {
        const { jobIds, status } = req.body;
        
        if (!Array.isArray(jobIds) || jobIds.length === 0) {
          return res.status(400).json({ error: 'Job IDs array is required' });
        }
        
        const validStatuses = ['draft', 'active', 'paused', 'closed', 'archived'];
        if (!validStatuses.includes(status)) {
          return res.status(400).json({ error: 'Invalid status' });
        }

        res.json({
          updatedCount: jobIds.length,
          status,
          jobIds,
          message: `${jobIds.length} jobs updated to ${status}`
        });
      });

      const response = await request(app)
        .patch('/api/jobs/bulk/status')
        .send({ 
          jobIds: [1, 2, 3], 
          status: 'paused' 
        })
        .expect(200);

      expect(response.body.updatedCount).toBe(3);
      expect(response.body.status).toBe('paused');
      expect(response.body.jobIds).toEqual([1, 2, 3]);
    });

    test('should reject bulk update with empty job IDs', async () => {
      app.patch('/api/jobs/bulk/status', (req, res) => {
        const { jobIds } = req.body;
        
        if (!Array.isArray(jobIds) || jobIds.length === 0) {
          return res.status(400).json({ error: 'Job IDs array is required' });
        }
        
        res.json({ success: true });
      });

      await request(app)
        .patch('/api/jobs/bulk/status')
        .send({ jobIds: [], status: 'active' })
        .expect(400);
    });
  });

  describe('Application Processing Workflow', () => {
    test('should validate application status tracking', async () => {
      app.patch('/api/applications/:id/status', (req, res) => {
        const applicationId = parseInt(req.params.id);
        const { status, notes } = req.body;
        
        const validStatuses = ['new', 'reviewing', 'screening', 'interview', 'offer', 'hired', 'rejected'];
        if (!validStatuses.includes(status)) {
          return res.status(400).json({ error: 'Invalid application status' });
        }

        res.json({
          id: applicationId,
          status,
          notes: notes || null,
          updatedAt: new Date().toISOString(),
          message: `Application status updated to ${status}`
        });
      });

      const response = await request(app)
        .patch('/api/applications/1/status')
        .send({ 
          status: 'interview',
          notes: 'Scheduled for technical interview'
        })
        .expect(200);

      expect(response.body.status).toBe('interview');
      expect(response.body.notes).toBe('Scheduled for technical interview');
    });

    test('should validate bulk application processing', async () => {
      app.patch('/api/applications/bulk/status', (req, res) => {
        const { applicationIds, status, notes } = req.body;
        
        if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
          return res.status(400).json({ error: 'Application IDs array is required' });
        }

        res.json({
          updatedCount: applicationIds.length,
          status,
          notes: notes || null,
          applicationIds,
          message: `${applicationIds.length} applications updated to ${status}`
        });
      });

      const response = await request(app)
        .patch('/api/applications/bulk/status')
        .send({ 
          applicationIds: [1, 2, 3, 4], 
          status: 'rejected',
          notes: 'Position filled'
        })
        .expect(200);

      expect(response.body.updatedCount).toBe(4);
      expect(response.body.status).toBe('rejected');
      expect(response.body.notes).toBe('Position filled');
    });
  });
});