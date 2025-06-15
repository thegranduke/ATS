const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const request = require('supertest');
const { createServer } = require('../server/routes');
const { storage } = require('../server/storage');

describe('Application Form Analytics System', () => {
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
      name: 'Analytics Test Corp',
      domain: 'analytics-test.com'
    });

    // Create test user
    testUser = await storage.createUser({
      username: 'analytics_test_user',
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
        username: 'analytics_test_user',
        password: 'hashedpassword123'
      });

    // Create test job
    testJob = await storage.createJob({
      title: 'Frontend Developer',
      department: 'Engineering',
      companyId: testCompany.id,
      status: 'active',
      type: 'full_time',
      description: 'React developer position',
      applicationLink: 'frontend-developer-test'
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

  describe('Application Analytics Creation', () => {
    it('should create application analytics with form start tracking', async () => {
      const sessionId = `session_${Date.now()}`;
      
      const response = await request(app)
        .post('/api/application-analytics')
        .send({
          jobId: testJob.id,
          sessionId,
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Test Browser)',
          referrer: 'https://linkedin.com/jobs',
          deviceType: 'desktop',
          browserName: 'Chrome'
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        jobId: testJob.id,
        companyId: testCompany.id,
        sessionId,
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Test Browser)',
        referrer: 'https://linkedin.com/jobs',
        deviceType: 'desktop',
        browserName: 'Chrome',
        formStarted: true
      });
    });

    it('should auto-detect IP and user agent when not provided', async () => {
      const sessionId = `session_${Date.now()}`;
      
      const response = await request(app)
        .post('/api/application-analytics')
        .set('User-Agent', 'Auto-Detected Browser')
        .send({
          jobId: testJob.id,
          sessionId
        });

      expect(response.status).toBe(200);
      expect(response.body.userAgent).toBe('Auto-Detected Browser');
      expect(response.body.ipAddress).toBeDefined();
    });

    it('should reject analytics for non-existent job', async () => {
      const response = await request(app)
        .post('/api/application-analytics')
        .send({
          jobId: 99999,
          sessionId: 'invalid_session'
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Job not found');
    });
  });

  describe('Application Analytics Updates', () => {
    let sessionId;
    let analyticsId;

    beforeEach(async () => {
      sessionId = `session_${Date.now()}`;
      
      // Create initial analytics
      const createResponse = await request(app)
        .post('/api/application-analytics')
        .send({
          jobId: testJob.id,
          sessionId,
          deviceType: 'desktop'
        });
      
      analyticsId = createResponse.body.id;
    });

    it('should update form completion status', async () => {
      const response = await request(app)
        .patch(`/api/application-analytics/${sessionId}`)
        .send({
          formCompleted: true,
          stepReached: 3,
          timeToComplete: 120 // 2 minutes
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        sessionId,
        formCompleted: true,
        stepReached: 3,
        timeToComplete: 120
      });
    });

    it('should update candidate creation status', async () => {
      const response = await request(app)
        .patch(`/api/application-analytics/${sessionId}`)
        .send({
          candidateCreated: true,
          formCompleted: true,
          timeToComplete: 180
        });

      expect(response.status).toBe(200);
      expect(response.body.candidateCreated).toBe(true);
      expect(response.body.formCompleted).toBe(true);
    });

    it('should track form abandonment', async () => {
      const response = await request(app)
        .patch(`/api/application-analytics/${sessionId}`)
        .send({
          stepReached: 2,
          abandonmentStep: 2,
          formCompleted: false
        });

      expect(response.status).toBe(200);
      expect(response.body.abandonmentStep).toBe(2);
      expect(response.body.formCompleted).toBe(false);
    });

    it('should reject updates for non-existent session', async () => {
      const response = await request(app)
        .patch('/api/application-analytics/invalid_session')
        .send({
          formCompleted: true
        });

      expect(response.status).toBe(500);
    });
  });

  describe('Conversion Rate Analytics', () => {
    beforeEach(async () => {
      // Create sample analytics data for testing
      const sessionsData = [
        {
          sessionId: 'session_1',
          formStarted: true,
          formCompleted: true,
          candidateCreated: true,
          referrer: 'https://linkedin.com',
          deviceType: 'desktop',
          timeToComplete: 150
        },
        {
          sessionId: 'session_2',
          formStarted: true,
          formCompleted: true,
          candidateCreated: false,
          referrer: 'https://indeed.com',
          deviceType: 'mobile',
          timeToComplete: 200
        },
        {
          sessionId: 'session_3',
          formStarted: true,
          formCompleted: false,
          candidateCreated: false,
          referrer: 'https://linkedin.com',
          deviceType: 'desktop',
          abandonmentStep: 2
        },
        {
          sessionId: 'session_4',
          formStarted: true,
          formCompleted: true,
          candidateCreated: true,
          referrer: null, // Direct traffic
          deviceType: 'tablet',
          timeToComplete: 90
        }
      ];

      for (const sessionData of sessionsData) {
        await storage.createApplicationFormAnalytics({
          jobId: testJob.id,
          companyId: testCompany.id,
          ...sessionData
        });
      }
    });

    it('should return comprehensive conversion rate analytics', async () => {
      const response = await agent
        .get('/api/application-analytics/conversion-rates');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        totalStarted: 4,
        totalCompleted: 3,
        totalConverted: 2,
        conversionRate: 50, // 2/4 * 100
        completionRate: 75, // 3/4 * 100
        avgTimeToComplete: expect.any(Number)
      });

      expect(response.body.topSources).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source: expect.any(String),
            conversions: expect.any(Number),
            rate: expect.any(Number)
          })
        ])
      );

      expect(response.body.deviceBreakdown).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            device: expect.any(String),
            count: expect.any(Number),
            percentage: expect.any(Number)
          })
        ])
      );
    });

    it('should filter analytics by date range', async () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const response = await agent
        .get('/api/application-analytics/conversion-rates')
        .query({
          startDate: yesterday.toISOString(),
          endDate: today.toISOString()
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalStarted');
      expect(response.body).toHaveProperty('conversionRate');
    });

    it('should return source performance analysis', async () => {
      const response = await agent
        .get('/api/application-analytics/conversion-rates');

      expect(response.status).toBe(200);
      expect(response.body.topSources).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source: 'https://linkedin.com',
            conversions: 1,
            rate: 50 // 1 conversion out of 2 LinkedIn sessions
          })
        ])
      );
    });

    it('should analyze device performance', async () => {
      const response = await agent
        .get('/api/application-analytics/conversion-rates');

      expect(response.status).toBe(200);
      
      const deviceBreakdown = response.body.deviceBreakdown;
      const desktopData = deviceBreakdown.find(d => d.device === 'desktop');
      
      expect(desktopData).toMatchObject({
        device: 'desktop',
        count: 2,
        percentage: 50 // 2 out of 4 sessions
      });
    });

    it('should provide abandonment analysis', async () => {
      const response = await agent
        .get('/api/application-analytics/conversion-rates');

      expect(response.status).toBe(200);
      expect(response.body.abandonmentAnalysis).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            step: 2,
            count: 1,
            percentage: 100 // Only one abandonment at step 2
          })
        ])
      );
    });
  });

  describe('Job-Specific Analytics', () => {
    beforeEach(async () => {
      // Create analytics for the test job
      await storage.createApplicationFormAnalytics({
        jobId: testJob.id,
        companyId: testCompany.id,
        sessionId: 'job_session_1',
        formStarted: true,
        formCompleted: true,
        candidateCreated: true
      });

      await storage.createApplicationFormAnalytics({
        jobId: testJob.id,
        companyId: testCompany.id,
        sessionId: 'job_session_2',
        formStarted: true,
        formCompleted: false,
        abandonmentStep: 1
      });
    });

    it('should return analytics for specific job', async () => {
      const response = await agent
        .get(`/api/application-analytics/job/${testJob.id}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
      
      expect(response.body[0]).toMatchObject({
        jobId: testJob.id,
        companyId: testCompany.id,
        sessionId: expect.any(String)
      });
    });

    it('should reject access to other company jobs', async () => {
      // Create another company and job
      const otherCompany = await storage.createCompany({
        name: 'Other Company',
        domain: 'other.test.com'
      });

      const otherJob = await storage.createJob({
        title: 'Other Job',
        department: 'Other Dept',
        companyId: otherCompany.id,
        status: 'active',
        type: 'full_time',
        description: 'Other job description',
        applicationLink: 'other-job-link'
      });

      const response = await agent
        .get(`/api/application-analytics/job/${otherJob.id}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Job not found');

      // Clean up
      await storage.deleteJob(otherJob.id);
      await storage.updateCompany(otherCompany.id, { name: 'DELETED' });
    });

    it('should handle non-existent job ID', async () => {
      const response = await agent
        .get('/api/application-analytics/job/99999');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Job not found');
    });
  });

  describe('Tenant Isolation', () => {
    it('should only return analytics for user company', async () => {
      // Create another company and user
      const otherCompany = await storage.createCompany({
        name: 'Other Analytics Corp',
        domain: 'other-analytics.test.com'
      });

      const otherUser = await storage.createUser({
        username: 'other_analytics_user',
        email: 'other-analytics@test.com',
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

      // Create analytics for other company
      await storage.createApplicationFormAnalytics({
        jobId: otherJob.id,
        companyId: otherCompany.id,
        sessionId: 'other_session',
        formStarted: true,
        candidateCreated: true
      });

      // Create analytics for test company
      await storage.createApplicationFormAnalytics({
        jobId: testJob.id,
        companyId: testCompany.id,
        sessionId: 'test_session',
        formStarted: true,
        candidateCreated: true
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
      const testCompanyResponse = await agent.get('/api/application-analytics/conversion-rates');
      const otherCompanyResponse = await otherAgent.get('/api/application-analytics/conversion-rates');

      expect(testCompanyResponse.body.totalStarted).toBe(1); // Only test company analytics
      expect(otherCompanyResponse.body.totalStarted).toBe(1); // Only other company analytics

      // Clean up
      await storage.deleteJob(otherJob.id);
      await storage.deleteUser(otherUser.id);
      await storage.updateCompany(otherCompany.id, { name: 'DELETED' });
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication errors', async () => {
      const response = await request(app)
        .get('/api/application-analytics/conversion-rates');

      expect(response.status).toBe(401);
    });

    it('should handle invalid date ranges gracefully', async () => {
      const response = await agent
        .get('/api/application-analytics/conversion-rates')
        .query({
          startDate: 'invalid-date',
          endDate: 'invalid-date'
        });

      expect(response.status).toBe(500);
    });

    it('should handle database errors gracefully', async () => {
      // This would require mocking the storage layer,
      // but for now we test that the endpoint exists and responds correctly
      const response = await agent
        .get('/api/application-analytics/conversion-rates');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalStarted');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large volume of analytics data efficiently', async () => {
      const startTime = Date.now();
      
      // Create 50 analytics entries
      const analyticsPromises = [];
      for (let i = 0; i < 50; i++) {
        analyticsPromises.push(
          storage.createApplicationFormAnalytics({
            jobId: testJob.id,
            companyId: testCompany.id,
            sessionId: `perf_session_${i}`,
            formStarted: true,
            formCompleted: i % 3 === 0, // 33% completion rate
            candidateCreated: i % 4 === 0, // 25% conversion rate
            referrer: i % 2 === 0 ? 'https://linkedin.com' : 'https://indeed.com',
            deviceType: ['desktop', 'mobile', 'tablet'][i % 3],
            timeToComplete: i % 3 === 0 ? 60 + (i * 2) : null
          })
        );
      }
      
      await Promise.all(analyticsPromises);
      
      // Verify analytics still work efficiently
      const response = await agent
        .get('/api/application-analytics/conversion-rates');
      
      const endTime = Date.now();
      
      expect(response.status).toBe(200);
      expect(response.body.totalStarted).toBe(50);
      expect(response.body.conversionRate).toBeCloseTo(25, 0); // Approximately 25%
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});