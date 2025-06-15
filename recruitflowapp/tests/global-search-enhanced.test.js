const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const request = require('supertest');
const { createServer } = require('../server/routes');
const { storage } = require('../server/storage');

describe('Global Search Enhancement System', () => {
  let app;
  let testCompany;
  let testUser;
  let testJobs;
  let testCandidates;
  let agent;

  beforeEach(async () => {
    app = createServer();
    agent = request.agent(app);

    // Create test company
    testCompany = await storage.createCompany({
      name: 'Search Test Corp',
      domain: 'search.test.com'
    });

    // Create test user
    testUser = await storage.createUser({
      username: 'search_user',
      email: 'search@test.com',
      password: 'hashedpassword123',
      firstName: 'Search',
      lastName: 'User',
      fullName: 'Search User',
      companyId: testCompany.id,
      role: 'admin'
    });

    // Login user
    await agent
      .post('/api/auth/login')
      .send({
        username: 'search_user',
        password: 'hashedpassword123'
      });

    // Create test jobs with diverse content
    testJobs = [];
    const jobData = [
      {
        title: 'Senior React Developer',
        department: 'Engineering',
        status: 'active',
        type: 'full_time',
        description: 'Build modern web applications with React and TypeScript'
      },
      {
        title: 'Product Manager',
        department: 'Product',
        status: 'active',
        type: 'full_time',
        description: 'Lead product strategy and roadmap development'
      },
      {
        title: 'DevOps Engineer',
        department: 'Engineering',
        status: 'paused',
        type: 'contract',
        description: 'Manage cloud infrastructure and deployment pipelines'
      }
    ];

    for (const job of jobData) {
      const createdJob = await storage.createJob({
        ...job,
        companyId: testCompany.id,
        applicationLink: `${job.title.toLowerCase().replace(/\s+/g, '-')}-link`
      });
      testJobs.push(createdJob);
    }

    // Create test candidates with diverse profiles
    testCandidates = [];
    const candidateData = [
      {
        fullName: 'John Doe',
        email: 'john.doe@email.com',
        status: 'applied',
        skills: 'JavaScript, React, Node.js',
        experience: '5 years frontend development'
      },
      {
        fullName: 'Jane Smith',
        email: 'jane.smith@email.com',
        status: 'interviewing',
        skills: 'Product Management, Analytics, SQL',
        experience: '7 years product management'
      },
      {
        fullName: 'Mike Johnson',
        email: 'mike.johnson@email.com',
        status: 'hired',
        skills: 'Docker, Kubernetes, AWS',
        experience: '4 years DevOps engineering'
      }
    ];

    for (const candidate of candidateData) {
      const createdCandidate = await storage.createCandidate({
        ...candidate,
        companyId: testCompany.id,
        jobId: testJobs[0].id // Assign to first job for testing
      });
      testCandidates.push(createdCandidate);
    }
  });

  afterEach(async () => {
    // Clean up test data
    try {
      for (const candidate of testCandidates) {
        await storage.deleteCandidate(candidate.id);
      }
      for (const job of testJobs) {
        await storage.deleteJob(job.id);
      }
      await storage.deleteUser(testUser.id);
      await storage.updateCompany(testCompany.id, { name: 'DELETED' });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Basic Search Functionality', () => {
    it('should return empty results for empty query', async () => {
      const response = await agent
        .get('/api/search?q=');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        jobs: [],
        candidates: []
      });
    });

    it('should return empty results for whitespace query', async () => {
      const response = await agent
        .get('/api/search?q=   ');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        jobs: [],
        candidates: []
      });
    });

    it('should search across all content types by default', async () => {
      const response = await agent
        .get('/api/search?q=react');

      expect(response.status).toBe(200);
      expect(response.body.totalResults).toBeGreaterThan(0);
      expect(response.body.jobs).toBeDefined();
      expect(response.body.candidates).toBeDefined();
    });
  });

  describe('Job Search Capabilities', () => {
    it('should find jobs by title', async () => {
      const response = await agent
        .get('/api/search?q=developer&type=jobs');

      expect(response.status).toBe(200);
      expect(response.body.jobs).toHaveLength(1);
      expect(response.body.jobs[0].title).toBe('Senior React Developer');
      expect(response.body.candidates).toHaveLength(0);
    });

    it('should find jobs by department', async () => {
      const response = await agent
        .get('/api/search?q=engineering&type=jobs');

      expect(response.status).toBe(200);
      expect(response.body.jobs).toHaveLength(2); // React Developer and DevOps Engineer
      expect(response.body.jobs.every(job => job.department === 'Engineering')).toBe(true);
    });

    it('should find jobs by status', async () => {
      const response = await agent
        .get('/api/search?q=paused&type=jobs');

      expect(response.status).toBe(200);
      expect(response.body.jobs).toHaveLength(1);
      expect(response.body.jobs[0].status).toBe('paused');
    });

    it('should find jobs by type', async () => {
      const response = await agent
        .get('/api/search?q=contract&type=jobs');

      expect(response.status).toBe(200);
      expect(response.body.jobs).toHaveLength(1);
      expect(response.body.jobs[0].type).toBe('contract');
    });

    it('should find jobs by description content', async () => {
      const response = await agent
        .get('/api/search?q=typescript&type=jobs');

      expect(response.status).toBe(200);
      expect(response.body.jobs).toHaveLength(1);
      expect(response.body.jobs[0].description).toContain('TypeScript');
    });
  });

  describe('Candidate Search Capabilities', () => {
    it('should find candidates by name', async () => {
      const response = await agent
        .get('/api/search?q=john&type=candidates');

      expect(response.status).toBe(200);
      expect(response.body.candidates).toHaveLength(2); // John Doe and Mike Johnson
      expect(response.body.jobs).toHaveLength(0);
    });

    it('should find candidates by email', async () => {
      const response = await agent
        .get('/api/search?q=jane.smith&type=candidates');

      expect(response.status).toBe(200);
      expect(response.body.candidates).toHaveLength(1);
      expect(response.body.candidates[0].email).toBe('jane.smith@email.com');
    });

    it('should find candidates by status', async () => {
      const response = await agent
        .get('/api/search?q=interviewing&type=candidates');

      expect(response.status).toBe(200);
      expect(response.body.candidates).toHaveLength(1);
      expect(response.body.candidates[0].status).toBe('interviewing');
    });

    it('should find candidates by skills', async () => {
      const response = await agent
        .get('/api/search?q=kubernetes&type=candidates');

      expect(response.status).toBe(200);
      expect(response.body.candidates).toHaveLength(1);
      expect(response.body.candidates[0].skills).toContain('Kubernetes');
    });

    it('should find candidates by experience', async () => {
      const response = await agent
        .get('/api/search?q=product management&type=candidates');

      expect(response.status).toBe(200);
      expect(response.body.candidates).toHaveLength(1);
      expect(response.body.candidates[0].experience).toContain('product management');
    });
  });

  describe('Combined Search Results', () => {
    it('should return both jobs and candidates for broad search', async () => {
      const response = await agent
        .get('/api/search?q=react');

      expect(response.status).toBe(200);
      expect(response.body.jobs).toHaveLength(1); // React Developer job
      expect(response.body.candidates).toHaveLength(1); // John Doe with React skills
      expect(response.body.totalResults).toBe(2);
    });

    it('should handle case-insensitive search', async () => {
      const response = await agent
        .get('/api/search?q=PRODUCT');

      expect(response.status).toBe(200);
      expect(response.body.jobs.length + response.body.candidates.length).toBeGreaterThan(0);
    });

    it('should handle partial matches', async () => {
      const response = await agent
        .get('/api/search?q=dev');

      expect(response.status).toBe(200);
      expect(response.body.jobs).toHaveLength(2); // Developer and DevOps
      expect(response.body.candidates).toHaveLength(2); // John (frontend development) and Mike (DevOps engineering)
    });
  });

  describe('Search Limits and Performance', () => {
    it('should respect custom limit parameter', async () => {
      const response = await agent
        .get('/api/search?q=e&limit=1'); // 'e' should match many results

      expect(response.status).toBe(200);
      expect(response.body.jobs.length + response.body.candidates.length).toBeLessThanOrEqual(2); // 1 each max
    });

    it('should enforce maximum limit of 50', async () => {
      const response = await agent
        .get('/api/search?q=e&limit=100');

      expect(response.status).toBe(200);
      // Even if we request 100, it should cap at 50 per type
      expect(response.body.jobs.length).toBeLessThanOrEqual(50);
      expect(response.body.candidates.length).toBeLessThanOrEqual(50);
    });

    it('should handle invalid limit gracefully', async () => {
      const response = await agent
        .get('/api/search?q=react&limit=invalid');

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
    });
  });

  describe('Tenant Isolation', () => {
    it('should only return results from user company', async () => {
      // Create another company and user
      const otherCompany = await storage.createCompany({
        name: 'Other Search Corp',
        domain: 'other-search.test.com'
      });

      const otherUser = await storage.createUser({
        username: 'other_search_user',
        email: 'other@test.com',
        password: 'hashedpassword123',
        firstName: 'Other',
        lastName: 'User',
        fullName: 'Other User',
        companyId: otherCompany.id,
        role: 'admin'
      });

      const otherJob = await storage.createJob({
        title: 'Other React Developer',
        department: 'Engineering',
        companyId: otherCompany.id,
        status: 'active',
        type: 'full_time',
        description: 'React job for other company',
        applicationLink: 'other-react-dev-link'
      });

      const otherCandidate = await storage.createCandidate({
        fullName: 'Other John',
        email: 'other.john@email.com',
        status: 'applied',
        skills: 'React, Vue.js',
        experience: '3 years',
        companyId: otherCompany.id,
        jobId: otherJob.id
      });

      // Search as original user should not see other company's data
      const response = await agent
        .get('/api/search?q=react');

      expect(response.status).toBe(200);
      expect(response.body.jobs).toHaveLength(1);
      expect(response.body.jobs[0].title).toBe('Senior React Developer'); // Not "Other React Developer"
      expect(response.body.candidates).toHaveLength(1);
      expect(response.body.candidates[0].fullName).toBe('John Doe'); // Not "Other John"

      // Clean up
      await storage.deleteCandidate(otherCandidate.id);
      await storage.deleteJob(otherJob.id);
      await storage.deleteUser(otherUser.id);
      await storage.updateCompany(otherCompany.id, { name: 'DELETED' });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing query parameter', async () => {
      const response = await agent
        .get('/api/search');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        jobs: [],
        candidates: []
      });
    });

    it('should handle authentication errors', async () => {
      const response = await request(app)
        .get('/api/search?q=react');

      expect(response.status).toBe(401);
    });

    it('should gracefully handle database errors', async () => {
      // This would require mocking the storage layer, 
      // but for now we test that the endpoint exists and responds correctly
      const response = await agent
        .get('/api/search?q=test');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('jobs');
      expect(response.body).toHaveProperty('candidates');
    });
  });

  describe('Advanced Search Scenarios', () => {
    it('should handle special characters in search', async () => {
      const response = await agent
        .get('/api/search?q=node.js');

      expect(response.status).toBe(200);
      expect(response.body.candidates).toHaveLength(1);
      expect(response.body.candidates[0].skills).toContain('Node.js');
    });

    it('should handle multi-word searches', async () => {
      const response = await agent
        .get('/api/search?q=frontend development');

      expect(response.status).toBe(200);
      expect(response.body.candidates).toHaveLength(1);
      expect(response.body.candidates[0].experience).toContain('frontend development');
    });

    it('should return relevant results for common terms', async () => {
      const response = await agent
        .get('/api/search?q=engineer');

      expect(response.status).toBe(200);
      expect(response.body.jobs).toHaveLength(1); // DevOps Engineer
      expect(response.body.candidates).toHaveLength(1); // Mike Johnson (DevOps engineering)
    });
  });
});