const request = require('supertest');
const express = require('express');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const { setupReportingRoutes } = require('../server/reporting');
const { MemStorage } = require('../server/storage');

describe('Enhanced Reporting and Analytics API', () => {
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
    setupReportingRoutes(app);

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

    // Create test jobs across multiple departments
    mockJobs = [];
    const departments = ['Engineering', 'Marketing', 'Sales'];
    const statuses = ['draft', 'active', 'closed'];
    
    for (let i = 0; i < 6; i++) {
      const job = await storage.createJob({
        title: `Job ${i + 1}`,
        department: departments[i % departments.length],
        companyId: mockCompany.id,
        status: statuses[i % statuses.length],
        type: i % 2 === 0 ? 'full-time' : 'part-time',
        description: `Test job description ${i + 1}`,
        applicationLink: `https://company.com/apply/${i + 1}`
      });
      mockJobs.push(job);
    }

    // Create test candidates with various statuses
    mockCandidates = [];
    const candidateStatuses = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected'];
    
    for (let i = 0; i < 12; i++) {
      const candidate = await storage.createCandidate({
        fullName: `Candidate ${i + 1}`,
        email: `candidate${i + 1}@example.com`,
        jobId: mockJobs[i % mockJobs.length].id,
        companyId: mockCompany.id,
        status: candidateStatuses[i % candidateStatuses.length]
      });
      mockCandidates.push(candidate);
    }

    // Create some application form analytics
    for (let i = 0; i < 8; i++) {
      await storage.createApplicationFormAnalytics({
        companyId: mockCompany.id,
        jobId: mockJobs[i % mockJobs.length].id,
        sessionId: `session-${i}`,
        formStarted: true,
        formCompleted: i % 3 !== 0, // 2/3 completion rate
        submitted: i % 4 === 0, // 1/4 submission rate
        startTime: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)), // Spread over days
        source: ['linkedin', 'indeed', 'company-website', 'referral'][i % 4],
        deviceType: ['desktop', 'mobile', 'tablet'][i % 3],
        browserName: ['chrome', 'firefox', 'safari'][i % 3]
      });
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

  describe('GET /api/reports/hiring-metrics', () => {
    it('should return comprehensive hiring metrics', async () => {
      const response = await request(app)
        .get('/api/reports/hiring-metrics?period=30d')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('metrics');
      expect(response.body).toHaveProperty('dateRange');
      expect(response.body).toHaveProperty('generatedAt');

      // Check overview metrics
      const overview = response.body.metrics.overview;
      expect(overview).toHaveProperty('totalJobs');
      expect(overview).toHaveProperty('activeJobs');
      expect(overview).toHaveProperty('totalCandidates');
      expect(overview).toHaveProperty('hiredCandidates');
      expect(overview).toHaveProperty('averageTimeToHire');
      expect(overview).toHaveProperty('conversionRate');

      // Check trends data
      const trends = response.body.metrics.trends;
      expect(trends).toHaveProperty('jobsCreated');
      expect(trends).toHaveProperty('candidatesApplied');
      expect(trends).toHaveProperty('hiringProgress');
      expect(Array.isArray(trends.jobsCreated)).toBe(true);

      // Check status breakdown
      const statusBreakdown = response.body.metrics.statusBreakdown;
      expect(statusBreakdown).toHaveProperty('jobs');
      expect(statusBreakdown).toHaveProperty('candidates');
      expect(Array.isArray(statusBreakdown.jobs)).toBe(true);
      expect(Array.isArray(statusBreakdown.candidates)).toBe(true);

      // Check department analytics
      expect(response.body.metrics).toHaveProperty('departmentAnalytics');
      expect(Array.isArray(response.body.metrics.departmentAnalytics)).toBe(true);

      // Check top performing jobs
      expect(response.body.metrics).toHaveProperty('topPerformingJobs');
      expect(Array.isArray(response.body.metrics.topPerformingJobs)).toBe(true);

      // Check bottleneck analysis
      expect(response.body.metrics).toHaveProperty('bottleneckAnalysis');
      expect(Array.isArray(response.body.metrics.bottleneckAnalysis)).toBe(true);
    });

    it('should support different time periods', async () => {
      const periods = ['7d', '30d', '90d', '1y'];
      
      for (const period of periods) {
        const response = await request(app)
          .get(`/api/reports/hiring-metrics?period=${period}`)
          .set('Cookie', sessionCookie);

        expect(response.status).toBe(200);
        expect(response.body.dateRange.period).toBe(period);
      }
    });

    it('should support custom date ranges', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';
      
      const response = await request(app)
        .get(`/api/reports/hiring-metrics?startDate=${startDate}&endDate=${endDate}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.dateRange).toHaveProperty('start');
      expect(response.body.dateRange).toHaveProperty('end');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/reports/hiring-metrics');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    });
  });

  describe('GET /api/reports/pipeline-analytics', () => {
    it('should return candidate pipeline analytics', async () => {
      const response = await request(app)
        .get('/api/reports/pipeline-analytics')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('pipeline');
      expect(response.body).toHaveProperty('filters');

      const pipeline = response.body.pipeline;
      expect(pipeline).toHaveProperty('totalCandidates');
      expect(pipeline).toHaveProperty('stageMetrics');
      expect(pipeline).toHaveProperty('conversionRates');
      expect(pipeline).toHaveProperty('stageTimings');
      expect(pipeline).toHaveProperty('dropOffAnalysis');

      // Check stage metrics structure
      expect(Array.isArray(pipeline.stageMetrics)).toBe(true);
      if (pipeline.stageMetrics.length > 0) {
        const stage = pipeline.stageMetrics[0];
        expect(stage).toHaveProperty('stage');
        expect(stage).toHaveProperty('count');
        expect(stage).toHaveProperty('percentage');
      }

      // Check conversion rates
      expect(Array.isArray(pipeline.conversionRates)).toBe(true);
      if (pipeline.conversionRates.length > 0) {
        const conversion = pipeline.conversionRates[0];
        expect(conversion).toHaveProperty('from');
        expect(conversion).toHaveProperty('to');
        expect(conversion).toHaveProperty('rate');
      }
    });

    it('should filter by specific job', async () => {
      const jobId = mockJobs[0].id;
      
      const response = await request(app)
        .get(`/api/reports/pipeline-analytics?jobId=${jobId}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.filters.jobId).toBe(jobId.toString());
    });

    it('should filter by date range', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';
      
      const response = await request(app)
        .get(`/api/reports/pipeline-analytics?startDate=${startDate}&endDate=${endDate}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.filters.dateRange).toEqual({ startDate, endDate });
    });
  });

  describe('GET /api/reports/source-performance', () => {
    it('should return source performance analytics', async () => {
      const response = await request(app)
        .get('/api/reports/source-performance?period=30d')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('sources');
      expect(response.body).toHaveProperty('summary');
      expect(response.body).toHaveProperty('period');

      // Check sources structure
      expect(Array.isArray(response.body.sources)).toBe(true);
      if (response.body.sources.length > 0) {
        const source = response.body.sources[0];
        expect(source).toHaveProperty('source');
        expect(source).toHaveProperty('totalApplications');
        expect(source).toHaveProperty('completedApplications');
        expect(source).toHaveProperty('conversions');
        expect(source).toHaveProperty('completionRate');
        expect(source).toHaveProperty('conversionRate');
        expect(source).toHaveProperty('topDevices');
        expect(source).toHaveProperty('topBrowsers');
      }

      // Check summary
      const summary = response.body.summary;
      expect(summary).toHaveProperty('totalSources');
      expect(summary).toHaveProperty('totalApplications');
      expect(summary).toHaveProperty('overallConversionRate');
      expect(typeof summary.overallConversionRate).toBe('number');
    });

    it('should include device and browser breakdown', async () => {
      const response = await request(app)
        .get('/api/reports/source-performance')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      
      if (response.body.sources.length > 0) {
        const source = response.body.sources[0];
        expect(Array.isArray(source.topDevices)).toBe(true);
        expect(Array.isArray(source.topBrowsers)).toBe(true);
        
        if (source.topDevices.length > 0) {
          expect(source.topDevices[0]).toHaveProperty('device');
          expect(source.topDevices[0]).toHaveProperty('count');
        }
      }
    });
  });

  describe('GET /api/reports/time-to-hire', () => {
    it('should return time-to-hire analytics', async () => {
      const response = await request(app)
        .get('/api/reports/time-to-hire?period=90d')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('summary');
      expect(response.body).toHaveProperty('departmentBreakdown');
      expect(response.body).toHaveProperty('timelineTrends');
      expect(response.body).toHaveProperty('individualHires');
      expect(response.body).toHaveProperty('filters');

      // Check summary metrics
      const summary = response.body.summary;
      expect(summary).toHaveProperty('totalHires');
      expect(summary).toHaveProperty('averageTimeToHire');
      expect(summary).toHaveProperty('medianTimeToHire');
      expect(summary).toHaveProperty('percentiles');
      expect(summary).toHaveProperty('fastestHire');
      expect(summary).toHaveProperty('slowestHire');

      // Check percentiles
      expect(summary.percentiles).toHaveProperty('p25');
      expect(summary.percentiles).toHaveProperty('p50');
      expect(summary.percentiles).toHaveProperty('p75');
      expect(summary.percentiles).toHaveProperty('p90');

      // Check department breakdown
      expect(Array.isArray(response.body.departmentBreakdown)).toBe(true);
      if (response.body.departmentBreakdown.length > 0) {
        const dept = response.body.departmentBreakdown[0];
        expect(dept).toHaveProperty('department');
        expect(dept).toHaveProperty('averageDays');
        expect(dept).toHaveProperty('hireCount');
      }

      // Check timeline trends
      expect(Array.isArray(response.body.timelineTrends)).toBe(true);
    });

    it('should filter by department', async () => {
      const response = await request(app)
        .get('/api/reports/time-to-hire?department=Engineering')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.filters.department).toBe('Engineering');
    });

    it('should filter by job type', async () => {
      const response = await request(app)
        .get('/api/reports/time-to-hire?jobType=full-time')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.filters.jobType).toBe('full-time');
    });
  });

  describe('POST /api/reports/custom', () => {
    it('should generate custom reports with specified metrics', async () => {
      const customReport = {
        name: 'Test Custom Report',
        metrics: ['job_count', 'candidate_count', 'hire_count', 'conversion_rate'],
        filters: {
          department: 'Engineering'
        },
        dateRange: {
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        },
        groupBy: 'department'
      };

      const response = await request(app)
        .post('/api/reports/custom')
        .set('Cookie', sessionCookie)
        .send(customReport);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('name', 'Test Custom Report');
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('groupedData');
      expect(response.body).toHaveProperty('filters');
      expect(response.body).toHaveProperty('dateRange');
      expect(response.body).toHaveProperty('generatedAt');
      expect(response.body).toHaveProperty('recordCount');

      // Check that requested metrics are included
      const data = response.body.data;
      expect(data).toHaveProperty('jobCount');
      expect(data).toHaveProperty('candidateCount');
      expect(data).toHaveProperty('hireCount');
      expect(data).toHaveProperty('conversionRate');

      // Check grouped data
      expect(Array.isArray(response.body.groupedData)).toBe(true);
    });

    it('should validate required metrics', async () => {
      const invalidReport = {
        name: 'Invalid Report',
        filters: {},
        dateRange: {
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        }
      };

      const response = await request(app)
        .post('/api/reports/custom')
        .set('Cookie', sessionCookie)
        .send(invalidReport);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Metrics are required');
    });

    it('should handle different metric combinations', async () => {
      const combinations = [
        ['job_count'],
        ['candidate_count', 'hire_count'],
        ['conversion_rate', 'time_to_hire'],
        ['applications_per_job']
      ];

      for (const metrics of combinations) {
        const response = await request(app)
          .post('/api/reports/custom')
          .set('Cookie', sessionCookie)
          .send({ metrics });

        expect(response.status).toBe(200);
        expect(response.body.data).toBeDefined();
      }
    });

    it('should support different grouping options', async () => {
      const groupByOptions = ['department', 'status', 'type'];

      for (const groupBy of groupByOptions) {
        const response = await request(app)
          .post('/api/reports/custom')
          .set('Cookie', sessionCookie)
          .send({
            metrics: ['job_count', 'candidate_count'],
            groupBy
          });

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body.groupedData)).toBe(true);
      }
    });
  });

  describe('Tenant Isolation', () => {
    it('should only show data from user\'s company', async () => {
      // Create second company with data
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

      // Create job and candidate for second company
      await storage.createJob({
        title: 'Other Job',
        department: 'Other',
        companyId: company2.id,
        status: 'active',
        type: 'full-time',
        description: 'Other job',
        applicationLink: 'https://other.com/apply'
      });

      await storage.createCandidate({
        fullName: 'Other Candidate',
        email: 'other@example.com',
        jobId: null,
        companyId: company2.id,
        status: 'hired'
      });

      // Login as first company user and get metrics
      const response = await request(app)
        .get('/api/reports/hiring-metrics')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      
      // Should only see data from first company
      const overview = response.body.metrics.overview;
      expect(overview.totalJobs).toBe(mockJobs.length);
      expect(overview.totalCandidates).toBe(mockCandidates.length);
    });
  });

  describe('Data Accuracy and Calculations', () => {
    it('should calculate conversion rates correctly', async () => {
      const response = await request(app)
        .get('/api/reports/hiring-metrics')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      
      const overview = response.body.metrics.overview;
      const expectedConversionRate = overview.totalCandidates > 0 ? 
        Math.round((overview.hiredCandidates / overview.totalCandidates) * 100) : 0;
      
      expect(overview.conversionRate).toBe(expectedConversionRate);
    });

    it('should provide accurate pipeline stage metrics', async () => {
      const response = await request(app)
        .get('/api/reports/pipeline-analytics')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      
      const pipeline = response.body.pipeline;
      const stageMetrics = pipeline.stageMetrics;
      
      // Verify percentages add up correctly (allowing for rounding)
      const totalPercentage = stageMetrics.reduce((sum, stage) => sum + stage.percentage, 0);
      expect(totalPercentage).toBeGreaterThanOrEqual(95); // Allow for rounding differences
    });

    it('should handle empty data gracefully', async () => {
      // Create new company with no data
      const emptyCompany = await storage.createCompany({
        name: 'Empty Company',
        subdomain: 'empty',
        settings: {}
      });

      const emptyUser = await storage.createUser({
        username: 'empty@test.com',
        password: 'hashedpassword',
        companyId: emptyCompany.id,
        role: 'admin'
      });

      // Login as empty company user
      const emptyLogin = await request(app)
        .post('/test-login')
        .send({
          user: emptyUser,
          activeTenantId: emptyCompany.id
        });

      const emptyCookie = emptyLogin.headers['set-cookie'];

      const response = await request(app)
        .get('/api/reports/hiring-metrics')
        .set('Cookie', emptyCookie);

      expect(response.status).toBe(200);
      expect(response.body.metrics.overview.totalJobs).toBe(0);
      expect(response.body.metrics.overview.totalCandidates).toBe(0);
      expect(response.body.metrics.overview.conversionRate).toBe(0);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle date range filtering efficiently', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/reports/hiring-metrics?period=1y')
        .set('Cookie', sessionCookie);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(5000); // Should respond within 5 seconds
    });

    it('should provide consistent results across multiple calls', async () => {
      const responses = await Promise.all([
        request(app).get('/api/reports/hiring-metrics').set('Cookie', sessionCookie),
        request(app).get('/api/reports/hiring-metrics').set('Cookie', sessionCookie),
        request(app).get('/api/reports/hiring-metrics').set('Cookie', sessionCookie)
      ]);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // All responses should have the same overview metrics
      const overviews = responses.map(r => r.body.metrics.overview);
      expect(overviews[0]).toEqual(overviews[1]);
      expect(overviews[1]).toEqual(overviews[2]);
    });
  });
});