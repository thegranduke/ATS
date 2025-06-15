const request = require('supertest');
const { app } = require('../server/index');
const { storage } = require('../server/storage');

describe('Application Submission API', () => {
  let testJob;
  let testCompany;

  beforeEach(async () => {
    // Create test company
    testCompany = await storage.createCompany({
      name: 'Test Company',
      industry: 'Technology',
      size: '50-100'
    });

    // Create test job with application link
    testJob = await storage.createJob({
      title: 'Software Engineer',
      department: 'Engineering',
      type: 'full-time',
      status: 'active',
      description: 'Test job description',
      companyId: testCompany.id,
      applicationLink: 'test-job-link-123'
    });
  });

  describe('POST /api/applications', () => {
    it('should successfully submit a valid application', async () => {
      const applicationData = {
        fullName: 'John Doe',
        email: 'john.doe@example.com',
        phone: '+1234567890',
        coverLetter: 'I am interested in this position',
        applicationLink: 'test-job-link-123'
      };

      const response = await request(app)
        .post('/api/applications')
        .send(applicationData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Application submitted successfully');
      expect(response.body.candidateId).toBeDefined();

      // Verify candidate was created
      const candidate = await storage.getCandidateById(response.body.candidateId);
      expect(candidate).toBeDefined();
      expect(candidate.fullName).toBe('John Doe');
      expect(candidate.email).toBe('john.doe@example.com');
      expect(candidate.jobId).toBe(testJob.id);
      expect(candidate.companyId).toBe(testCompany.id);
      expect(candidate.status).toBe('new');
    });

    it('should return 404 for invalid application link', async () => {
      const applicationData = {
        fullName: 'John Doe',
        email: 'john.doe@example.com',
        applicationLink: 'invalid-link'
      };

      const response = await request(app)
        .post('/api/applications')
        .send(applicationData)
        .expect(404);

      expect(response.body.error).toBe('Job not found');
    });

    it('should return 400 for missing required fields', async () => {
      const applicationData = {
        fullName: 'John Doe',
        // Missing email and applicationLink
      };

      const response = await request(app)
        .post('/api/applications')
        .send(applicationData)
        .expect(400);

      expect(response.body.error).toBe('Invalid application data');
      expect(response.body.details).toBeDefined();
    });

    it('should handle optional fields correctly', async () => {
      const applicationData = {
        fullName: 'Jane Smith',
        email: 'jane.smith@example.com',
        applicationLink: 'test-job-link-123'
        // No phone or coverLetter
      };

      const response = await request(app)
        .post('/api/applications')
        .send(applicationData)
        .expect(201);

      expect(response.body.success).toBe(true);
      
      const candidate = await storage.getCandidateById(response.body.candidateId);
      expect(candidate.phone).toBeNull();
      expect(candidate.notes).toBeNull();
    });

    it('should create notification for new application', async () => {
      // Create a test user for the company
      const testUser = await storage.createUser({
        username: 'test@company.com',
        email: 'test@company.com',
        password: 'hashedpassword',
        firstName: 'Test',
        lastName: 'User',
        fullName: 'Test User',
        companyId: testCompany.id,
        role: 'admin'
      });

      const applicationData = {
        fullName: 'John Doe',
        email: 'john.doe@example.com',
        applicationLink: 'test-job-link-123'
      };

      await request(app)
        .post('/api/applications')
        .send(applicationData)
        .expect(201);

      // Check if notification was created
      const notifications = await storage.getNotificationsByUser(testUser.id);
      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('new_candidate');
      expect(notifications[0].title).toBe('New Candidate Application');
    });
  });
});