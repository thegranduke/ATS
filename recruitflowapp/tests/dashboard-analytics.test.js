const request = require('supertest');
const { app } = require('../server/index');
const { storage } = require('../server/storage');

describe('Dashboard Analytics API', () => {
  let testCompany;
  let testUser;
  let testJobs = [];
  let testCandidates = [];
  let authCookie;

  beforeEach(async () => {
    // Create test company
    testCompany = await storage.createCompany({
      name: 'Analytics Test Company',
      industry: 'Technology',
      size: '50-100'
    });

    // Create test user
    testUser = await storage.createUser({
      username: 'analytics@company.com',
      email: 'analytics@company.com',
      password: 'hashedpassword',
      firstName: 'Analytics',
      lastName: 'User',
      fullName: 'Analytics User',
      companyId: testCompany.id,
      role: 'admin'
    });

    // Create test jobs
    const jobsData = [
      {
        title: 'Frontend Developer',
        department: 'Engineering',
        type: 'full-time',
        status: 'active',
        description: 'Frontend development role',
        companyId: testCompany.id,
        applicationLink: 'frontend-dev-123'
      },
      {
        title: 'Backend Developer',
        department: 'Engineering',
        type: 'full-time',
        status: 'active',
        description: 'Backend development role',
        companyId: testCompany.id,
        applicationLink: 'backend-dev-456'
      },
      {
        title: 'Data Scientist',
        department: 'Data',
        type: 'contract',
        status: 'inactive',
        description: 'Data science role',
        companyId: testCompany.id,
        applicationLink: 'data-scientist-789'
      }
    ];

    testJobs = [];
    for (const jobData of jobsData) {
      const job = await storage.createJob(jobData);
      testJobs.push(job);
    }

    // Create test candidates with different creation dates and statuses
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 15);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);

    const candidatesData = [
      {
        fullName: 'Current Month Candidate 1',
        email: 'current1@example.com',
        status: 'new',
        jobId: testJobs[0].id,
        companyId: testCompany.id,
        createdAt: thisMonth
      },
      {
        fullName: 'Current Month Candidate 2',
        email: 'current2@example.com',
        status: 'interview',
        jobId: testJobs[1].id,
        companyId: testCompany.id,
        createdAt: thisMonth
      },
      {
        fullName: 'Last Month Candidate 1',
        email: 'last1@example.com',
        status: 'hired',
        jobId: testJobs[0].id,
        companyId: testCompany.id,
        createdAt: lastMonth
      },
      {
        fullName: 'Last Month Candidate 2',
        email: 'last2@example.com',
        status: 'rejected',
        jobId: testJobs[1].id,
        companyId: testCompany.id,
        createdAt: lastMonth
      }
    ];

    testCandidates = [];
    for (const candidateData of candidatesData) {
      const candidate = await storage.createCandidate(candidateData);
      testCandidates.push(candidate);
    }

    // Login to get auth cookie
    const loginResponse = await request(app)
      .post('/api/login')
      .send({
        username: 'analytics@company.com',
        password: 'hashedpassword'
      });
    
    authCookie = loginResponse.headers['set-cookie'];
  });

  describe('GET /api/dashboard/analytics', () => {
    it('should return comprehensive dashboard analytics', async () => {
      const response = await request(app)
        .get('/api/dashboard/analytics')
        .set('Cookie', authCookie)
        .expect(200);

      const analytics = response.body;

      // Verify core metrics
      expect(analytics.totalApplications).toBe(4);
      expect(analytics.activeJobs).toBe(2);
      expect(analytics.totalJobs).toBe(3);

      // Verify application change calculation
      expect(analytics.applicationChange).toBe(0); // 2 this month vs 2 last month = 0% change

      // Verify job views metrics exist
      expect(analytics.totalJobViews).toBeDefined();
      expect(analytics.jobViewsChange).toBeDefined();

      // Verify status distribution
      expect(analytics.statusDistribution).toBeDefined();
      expect(analytics.statusDistribution.new).toBe(1);
      expect(analytics.statusDistribution.interview).toBe(1);
      expect(analytics.statusDistribution.hired).toBe(1);
      expect(analytics.statusDistribution.rejected).toBe(1);

      // Verify recent activity
      expect(analytics.recentActivity).toBeDefined();
      expect(Array.isArray(analytics.recentActivity)).toBe(true);
      expect(analytics.recentActivity.length).toBeLessThanOrEqual(10);

      // Verify time-based metrics
      expect(analytics.metrics).toBeDefined();
      expect(analytics.metrics.currentMonthApplications).toBe(2);
      expect(analytics.metrics.lastMonthApplications).toBe(2);
    });

    it('should handle companies with no data gracefully', async () => {
      // Create a new company with no jobs or candidates
      const emptyCompany = await storage.createCompany({
        name: 'Empty Company',
        industry: 'Technology',
        size: '1-10'
      });

      const emptyUser = await storage.createUser({
        username: 'empty@company.com',
        email: 'empty@company.com',
        password: 'hashedpassword',
        firstName: 'Empty',
        lastName: 'User',
        fullName: 'Empty User',
        companyId: emptyCompany.id,
        role: 'admin'
      });

      // Login as the empty company user
      const emptyLoginResponse = await request(app)
        .post('/api/login')
        .send({
          username: 'empty@company.com',
          password: 'hashedpassword'
        });
      
      const emptyAuthCookie = emptyLoginResponse.headers['set-cookie'];

      const response = await request(app)
        .get('/api/dashboard/analytics')
        .set('Cookie', emptyAuthCookie)
        .expect(200);

      const analytics = response.body;

      expect(analytics.totalApplications).toBe(0);
      expect(analytics.activeJobs).toBe(0);
      expect(analytics.totalJobs).toBe(0);
      expect(analytics.applicationChange).toBe(0);
      expect(analytics.recentActivity).toHaveLength(0);
    });

    it('should calculate percentage changes correctly', async () => {
      // Add more candidates to this month to test positive change
      const thisMonth = new Date();
      
      const newCandidates = [
        {
          fullName: 'Additional Candidate 1',
          email: 'additional1@example.com',
          status: 'new',
          jobId: testJobs[0].id,
          companyId: testCompany.id,
          createdAt: thisMonth
        },
        {
          fullName: 'Additional Candidate 2',
          email: 'additional2@example.com',
          status: 'screening',
          jobId: testJobs[1].id,
          companyId: testCompany.id,
          createdAt: thisMonth
        }
      ];

      for (const candidateData of newCandidates) {
        await storage.createCandidate(candidateData);
      }

      const response = await request(app)
        .get('/api/dashboard/analytics')
        .set('Cookie', authCookie)
        .expect(200);

      const analytics = response.body;

      // Now we have 4 this month vs 2 last month = 100% increase
      expect(analytics.applicationChange).toBe(100);
      expect(analytics.metrics.currentMonthApplications).toBe(4);
      expect(analytics.metrics.lastMonthApplications).toBe(2);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/dashboard/analytics')
        .expect(401);
    });

    it('should include proper job titles in recent activity', async () => {
      const response = await request(app)
        .get('/api/dashboard/analytics')
        .set('Cookie', authCookie)
        .expect(200);

      const analytics = response.body;
      
      expect(analytics.recentActivity.length).toBeGreaterThan(0);
      
      const firstActivity = analytics.recentActivity[0];
      expect(firstActivity).toHaveProperty('candidateName');
      expect(firstActivity).toHaveProperty('jobTitle');
      expect(firstActivity).toHaveProperty('message');
      expect(firstActivity).toHaveProperty('timestamp');
      expect(firstActivity.type).toBe('application');
    });

    it('should respect tenant isolation', async () => {
      // Create another company with different data
      const otherCompany = await storage.createCompany({
        name: 'Other Company',
        industry: 'Finance',
        size: '100-500'
      });

      const otherUser = await storage.createUser({
        username: 'other@company.com',
        email: 'other@company.com',
        password: 'hashedpassword',
        firstName: 'Other',
        lastName: 'User',
        fullName: 'Other User',
        companyId: otherCompany.id,
        role: 'admin'
      });

      // Add some data to the other company
      const otherJob = await storage.createJob({
        title: 'Finance Manager',
        department: 'Finance',
        type: 'full-time',
        status: 'active',
        description: 'Finance management role',
        companyId: otherCompany.id,
        applicationLink: 'finance-manager-999'
      });

      await storage.createCandidate({
        fullName: 'Other Company Candidate',
        email: 'other.candidate@example.com',
        status: 'new',
        jobId: otherJob.id,
        companyId: otherCompany.id
      });

      // Login as other company user
      const otherLoginResponse = await request(app)
        .post('/api/login')
        .send({
          username: 'other@company.com',
          password: 'hashedpassword'
        });
      
      const otherAuthCookie = otherLoginResponse.headers['set-cookie'];

      // Get analytics for other company
      const otherResponse = await request(app)
        .get('/api/dashboard/analytics')
        .set('Cookie', otherAuthCookie)
        .expect(200);

      // Get analytics for original company
      const originalResponse = await request(app)
        .get('/api/dashboard/analytics')
        .set('Cookie', authCookie)
        .expect(200);

      // Verify data isolation
      expect(otherResponse.body.totalApplications).toBe(1);
      expect(otherResponse.body.totalJobs).toBe(1);
      
      expect(originalResponse.body.totalApplications).toBe(4);
      expect(originalResponse.body.totalJobs).toBe(3);
    });
  });
});