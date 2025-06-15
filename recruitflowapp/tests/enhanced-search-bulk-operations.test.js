const request = require('supertest');
const { app } = require('../server/index');
const { storage } = require('../server/storage');

describe('Enhanced Search and Bulk Operations API', () => {
  let testCompany;
  let testUser;
  let testJobs = [];
  let testCandidates = [];
  let authCookie;

  beforeEach(async () => {
    // Create test company
    testCompany = await storage.createCompany({
      name: 'Test Company',
      industry: 'Technology',
      size: '50-100'
    });

    // Create test user
    testUser = await storage.createUser({
      username: 'test@company.com',
      email: 'test@company.com',
      password: 'hashedpassword',
      firstName: 'Test',
      lastName: 'User',
      fullName: 'Test User',
      companyId: testCompany.id,
      role: 'admin'
    });

    // Create test jobs with different properties
    const jobsData = [
      {
        title: 'Senior Software Engineer',
        department: 'Engineering',
        type: 'full-time',
        status: 'active',
        experience: 'senior',
        description: 'Senior role in engineering team',
        companyId: testCompany.id
      },
      {
        title: 'Junior Developer',
        department: 'Engineering',
        type: 'full-time',
        status: 'inactive',
        experience: 'junior',
        description: 'Entry level position',
        companyId: testCompany.id
      },
      {
        title: 'Marketing Manager',
        department: 'Marketing',
        type: 'contract',
        status: 'active',
        experience: 'mid-level',
        description: 'Marketing leadership role',
        companyId: testCompany.id
      }
    ];

    testJobs = [];
    for (const jobData of jobsData) {
      const job = await storage.createJob(jobData);
      testJobs.push(job);
    }

    // Create test candidates
    const candidatesData = [
      {
        fullName: 'Alice Johnson',
        email: 'alice@example.com',
        status: 'new',
        jobId: testJobs[0].id,
        companyId: testCompany.id
      },
      {
        fullName: 'Bob Smith',
        email: 'bob@example.com',
        status: 'interview',
        jobId: testJobs[1].id,
        companyId: testCompany.id
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
        username: 'test@company.com',
        password: 'hashedpassword'
      });
    
    authCookie = loginResponse.headers['set-cookie'];
  });

  describe('Enhanced Job Search API', () => {
    it('should return all jobs without filters', async () => {
      const response = await request(app)
        .get('/api/jobs')
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.body.jobs).toHaveLength(3);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.totalJobs).toBe(3);
    });

    it('should filter jobs by search term', async () => {
      const response = await request(app)
        .get('/api/jobs?search=engineer')
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.body.jobs).toHaveLength(1);
      expect(response.body.jobs[0].title).toBe('Senior Software Engineer');
    });

    it('should filter jobs by status', async () => {
      const response = await request(app)
        .get('/api/jobs?status=active')
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.body.jobs).toHaveLength(2);
      response.body.jobs.forEach(job => {
        expect(job.status).toBe('active');
      });
    });

    it('should filter jobs by type', async () => {
      const response = await request(app)
        .get('/api/jobs?type=contract')
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.body.jobs).toHaveLength(1);
      expect(response.body.jobs[0].type).toBe('contract');
    });

    it('should filter jobs by experience level', async () => {
      const response = await request(app)
        .get('/api/jobs?experience=senior')
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.body.jobs).toHaveLength(1);
      expect(response.body.jobs[0].experience).toBe('senior');
    });

    it('should sort jobs by title ascending', async () => {
      const response = await request(app)
        .get('/api/jobs?sortBy=title&sortOrder=asc')
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.body.jobs[0].title).toBe('Junior Developer');
      expect(response.body.jobs[1].title).toBe('Marketing Manager');
      expect(response.body.jobs[2].title).toBe('Senior Software Engineer');
    });

    it('should handle pagination correctly', async () => {
      const response = await request(app)
        .get('/api/jobs?page=1&limit=2')
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.body.jobs).toHaveLength(2);
      expect(response.body.pagination.currentPage).toBe(1);
      expect(response.body.pagination.totalPages).toBe(2);
      expect(response.body.pagination.hasNextPage).toBe(true);
    });

    it('should combine multiple filters', async () => {
      const response = await request(app)
        .get('/api/jobs?status=active&type=full-time&sortBy=title')
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.body.jobs).toHaveLength(1);
      expect(response.body.jobs[0].title).toBe('Senior Software Engineer');
      expect(response.body.jobs[0].status).toBe('active');
      expect(response.body.jobs[0].type).toBe('full-time');
    });
  });

  describe('Bulk Jobs Operations API', () => {
    it('should successfully delete multiple jobs', async () => {
      const jobIds = [testJobs[0].id, testJobs[1].id];
      
      const response = await request(app)
        .post('/api/jobs/bulk')
        .set('Cookie', authCookie)
        .send({
          action: 'delete',
          jobIds: jobIds
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.results).toHaveLength(2);
      expect(response.body.summary.successful).toBe(2);
      expect(response.body.summary.failed).toBe(0);

      // Verify jobs are deleted
      const remainingJobs = await storage.getJobsByCompany(testCompany.id);
      expect(remainingJobs).toHaveLength(1);
    });

    it('should successfully activate multiple jobs', async () => {
      const jobIds = [testJobs[1].id]; // This job is currently inactive
      
      const response = await request(app)
        .post('/api/jobs/bulk')
        .set('Cookie', authCookie)
        .send({
          action: 'activate',
          jobIds: jobIds
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.results[0].status).toBe('activated');

      // Verify job status changed
      const updatedJob = await storage.getJobById(testJobs[1].id);
      expect(updatedJob.status).toBe('active');
    });

    it('should handle mixed success and failure in bulk operations', async () => {
      const jobIds = [testJobs[0].id, 99999]; // Second ID doesn't exist
      
      const response = await request(app)
        .post('/api/jobs/bulk')
        .set('Cookie', authCookie)
        .send({
          action: 'archive',
          jobIds: jobIds
        })
        .expect(200);

      expect(response.body.results).toHaveLength(1);
      expect(response.body.errors).toHaveLength(1);
      expect(response.body.summary.successful).toBe(1);
      expect(response.body.summary.failed).toBe(1);
    });

    it('should reject unauthorized bulk operations', async () => {
      const jobIds = [testJobs[0].id];
      
      await request(app)
        .post('/api/jobs/bulk')
        .send({
          action: 'delete',
          jobIds: jobIds
        })
        .expect(401);
    });
  });

  describe('Bulk Candidates Operations API', () => {
    it('should successfully update multiple candidate statuses', async () => {
      const candidateIds = [testCandidates[0].id, testCandidates[1].id];
      
      const response = await request(app)
        .post('/api/candidates/bulk')
        .set('Cookie', authCookie)
        .send({
          action: 'update_status',
          candidateIds: candidateIds,
          newStatus: 'screening'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.results).toHaveLength(2);
      expect(response.body.summary.successful).toBe(2);

      // Verify candidate statuses changed
      const updatedCandidate1 = await storage.getCandidateById(testCandidates[0].id);
      const updatedCandidate2 = await storage.getCandidateById(testCandidates[1].id);
      expect(updatedCandidate1.status).toBe('screening');
      expect(updatedCandidate2.status).toBe('screening');
    });

    it('should successfully delete multiple candidates', async () => {
      const candidateIds = [testCandidates[0].id];
      
      const response = await request(app)
        .post('/api/candidates/bulk')
        .set('Cookie', authCookie)
        .send({
          action: 'delete',
          candidateIds: candidateIds
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.results[0].status).toBe('deleted');

      // Verify candidate is deleted
      const remainingCandidates = await storage.getCandidatesByCompany(testCompany.id);
      expect(remainingCandidates).toHaveLength(1);
    });

    it('should reject invalid status updates', async () => {
      const candidateIds = [testCandidates[0].id];
      
      const response = await request(app)
        .post('/api/candidates/bulk')
        .set('Cookie', authCookie)
        .send({
          action: 'update_status',
          candidateIds: candidateIds,
          newStatus: 'invalid_status'
        })
        .expect(200);

      expect(response.body.results).toHaveLength(0);
      expect(response.body.errors).toHaveLength(1);
      expect(response.body.errors[0].error).toContain('Invalid status');
    });

    it('should reject bulk operations without required parameters', async () => {
      await request(app)
        .post('/api/candidates/bulk')
        .set('Cookie', authCookie)
        .send({
          action: 'update_status'
          // Missing candidateIds and newStatus
        })
        .expect(400);
    });
  });
});