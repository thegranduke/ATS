const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const request = require('supertest');
const { createServer } = require('../server/routes');
const { storage } = require('../server/storage');

describe('Job Views Analytics System', () => {
  let app;
  let testCompany;
  let testUser;
  let testJob;
  let agent;

  beforeEach(async () => {
    app = createServer();
    agent = request.agent(app);

    // Create test company
    testCompany = await storage.createCompany({
      name: 'Test Analytics Corp',
      domain: 'analytics.test.com'
    });

    // Create test user
    testUser = await storage.createUser({
      username: 'analytics_user',
      email: 'analytics@test.com',
      password: 'hashedpassword123',
      firstName: 'Analytics',
      lastName: 'User',
      fullName: 'Analytics User',
      companyId: testCompany.id,
      role: 'admin'
    });

    // Login user
    await agent
      .post('/api/auth/login')
      .send({
        username: 'analytics_user',
        password: 'hashedpassword123'
      });

    // Create test job
    testJob = await storage.createJob({
      title: 'Analytics Engineer',
      department: 'Engineering',
      companyId: testCompany.id,
      status: 'active',
      type: 'full_time',
      description: 'Analytics role for testing job views',
      applicationLink: 'test-analytics-engineer-link'
    });
  });

  afterEach(async () => {
    // Clean up test data
    try {
      await storage.deleteJob(testJob.id);
      await storage.deleteUser(testUser.id);
      await storage.updateCompany(testCompany.id, { name: 'DELETED' });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Job View Creation', () => {
    it('should create job view with proper analytics data', async () => {
      const response = await request(app)
        .post('/api/job-views')
        .send({
          jobId: testJob.id,
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Test Browser)',
          referrer: 'https://linkedin.com/jobs'
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        jobId: testJob.id,
        companyId: testCompany.id,
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Test Browser)',
        referrer: 'https://linkedin.com/jobs'
      });
      expect(response.body.viewedAt).toBeDefined();
    });

    it('should auto-detect IP and user agent when not provided', async () => {
      const response = await request(app)
        .post('/api/job-views')
        .set('User-Agent', 'Auto-Detected Browser')
        .send({
          jobId: testJob.id
        });

      expect(response.status).toBe(200);
      expect(response.body.userAgent).toBe('Auto-Detected Browser');
      expect(response.body.ipAddress).toBeDefined();
    });

    it('should reject job view for non-existent job', async () => {
      const response = await request(app)
        .post('/api/job-views')
        .send({
          jobId: 99999,
          ipAddress: '192.168.1.100'
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Job not found');
    });
  });

  describe('Job Views Analytics API', () => {
    beforeEach(async () => {
      // Create sample job views for analytics testing
      const currentMonth = new Date();
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      // Create 5 views this month
      for (let i = 0; i < 5; i++) {
        await storage.createJobView({
          jobId: testJob.id,
          companyId: testCompany.id,
          ipAddress: `192.168.1.${100 + i}`,
          userAgent: 'Test Browser',
          referrer: 'https://test.com'
        });
      }

      // Create 3 views last month (simulate by creating and manually updating timestamps)
      for (let i = 0; i < 3; i++) {
        const view = await storage.createJobView({
          jobId: testJob.id,
          companyId: testCompany.id,
          ipAddress: `192.168.2.${100 + i}`,
          userAgent: 'Test Browser',
          referrer: 'https://test.com'
        });
        
        // Manually update timestamp to last month using direct database access
        await storage.pool.query(
          'UPDATE job_views SET viewed_at = $1 WHERE id = $2',
          [lastMonth, view.id]
        );
      }
    });

    it('should return comprehensive analytics data', async () => {
      const response = await agent
        .get('/api/job-views/analytics');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        totalViews: 8, // 5 current + 3 last month
        currentMonthViews: 5,
        lastMonthViews: 3,
        percentageChange: expect.any(Number),
        trend: expect.stringMatching(/^(up|down|same)$/)
      });

      // Calculate expected percentage change: ((5 - 3) / 3) * 100 = 66.67%
      expect(response.body.percentageChange).toBeCloseTo(66.67, 1);
      expect(response.body.trend).toBe('up');
    });

    it('should return job-specific view counts', async () => {
      const response = await agent
        .get('/api/job-views/count/company');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toContainEqual({
        jobId: testJob.id,
        count: 8
      });
    });

    it('should handle zero views gracefully', async () => {
      // Create a new job with no views
      const newJob = await storage.createJob({
        title: 'No Views Job',
        department: 'Testing',
        companyId: testCompany.id,
        status: 'active',
        type: 'full_time',
        description: 'Job with no views',
        applicationLink: 'no-views-job-link'
      });

      const response = await agent
        .get('/api/job-views/analytics');

      expect(response.status).toBe(200);
      expect(response.body.totalViews).toBeGreaterThanOrEqual(0);

      // Clean up
      await storage.deleteJob(newJob.id);
    });

    it('should respect tenant isolation for analytics', async () => {
      // Create another company and user
      const otherCompany = await storage.createCompany({
        name: 'Other Analytics Corp',
        domain: 'other.test.com'
      });

      const otherUser = await storage.createUser({
        username: 'other_analytics_user',
        email: 'other@test.com',
        password: 'hashedpassword123',
        firstName: 'Other',
        lastName: 'User',
        fullName: 'Other User',
        companyId: otherCompany.id,
        role: 'admin'
      });

      const otherJob = await storage.createJob({
        title: 'Other Company Job',
        department: 'Engineering',
        companyId: otherCompany.id,
        status: 'active',
        type: 'full_time',
        description: 'Job for other company',
        applicationLink: 'other-company-job-link'
      });

      // Create views for other company
      await storage.createJobView({
        jobId: otherJob.id,
        companyId: otherCompany.id,
        ipAddress: '10.0.0.1',
        userAgent: 'Other Browser',
        referrer: 'https://other.com'
      });

      // Login as other user
      const otherAgent = request.agent(app);
      await otherAgent
        .post('/api/auth/login')
        .send({
          username: 'other_analytics_user',
          password: 'hashedpassword123'
        });

      // Check that each company only sees their own analytics
      const testCompanyResponse = await agent.get('/api/job-views/analytics');
      const otherCompanyResponse = await otherAgent.get('/api/job-views/analytics');

      expect(testCompanyResponse.body.totalViews).toBe(8); // Only test company views
      expect(otherCompanyResponse.body.totalViews).toBe(1); // Only other company views

      // Clean up
      await storage.deleteJob(otherJob.id);
      await storage.deleteUser(otherUser.id);
      await storage.updateCompany(otherCompany.id, { name: 'DELETED' });
    });
  });

  describe('Analytics Edge Cases', () => {
    it('should handle same period comparison correctly', async () => {
      // Create views only for current month
      for (let i = 0; i < 3; i++) {
        await storage.createJobView({
          jobId: testJob.id,
          companyId: testCompany.id,
          ipAddress: `192.168.3.${100 + i}`,
          userAgent: 'Test Browser',
          referrer: 'https://test.com'
        });
      }

      const response = await agent
        .get('/api/job-views/analytics');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        totalViews: 3,
        currentMonthViews: 3,
        lastMonthViews: 0,
        percentageChange: 0,
        trend: 'same'
      });
    });

    it('should calculate negative growth correctly', async () => {
      // Create more views for last month than current month
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      // 2 views current month
      for (let i = 0; i < 2; i++) {
        await storage.createJobView({
          jobId: testJob.id,
          companyId: testCompany.id,
          ipAddress: `192.168.4.${100 + i}`,
          userAgent: 'Test Browser',
          referrer: 'https://test.com'
        });
      }

      // 5 views last month
      for (let i = 0; i < 5; i++) {
        const view = await storage.createJobView({
          jobId: testJob.id,
          companyId: testCompany.id,
          ipAddress: `192.168.5.${100 + i}`,
          userAgent: 'Test Browser',
          referrer: 'https://test.com'
        });
        
        await storage.pool.query(
          'UPDATE job_views SET viewed_at = $1 WHERE id = $2',
          [lastMonth, view.id]
        );
      }

      const response = await agent
        .get('/api/job-views/analytics');

      expect(response.status).toBe(200);
      expect(response.body.trend).toBe('down');
      expect(response.body.percentageChange).toBeCloseTo(60, 1); // ((2 - 5) / 5) * 100 = -60%
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large volume of job views efficiently', async () => {
      const startTime = Date.now();
      
      // Create 100 job views
      const viewPromises = [];
      for (let i = 0; i < 100; i++) {
        viewPromises.push(
          storage.createJobView({
            jobId: testJob.id,
            companyId: testCompany.id,
            ipAddress: `192.168.10.${i % 255}`,
            userAgent: `Browser ${i}`,
            referrer: 'https://performance.test.com'
          })
        );
      }
      
      await Promise.all(viewPromises);
      
      // Verify analytics still work efficiently
      const response = await agent
        .get('/api/job-views/analytics');
      
      const endTime = Date.now();
      
      expect(response.status).toBe(200);
      expect(response.body.totalViews).toBe(100);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});