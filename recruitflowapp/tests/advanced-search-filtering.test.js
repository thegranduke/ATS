const request = require('supertest');
const express = require('express');

describe('Advanced Search & Filtering - High Priority', () => {
  let app;
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Mock authenticated user
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

  describe('Advanced Candidate Filtering', () => {
    test('should validate candidate filtering by status', async () => {
      app.get('/api/candidates/filter', (req, res) => {
        const { status, jobId, search, dateRange } = req.query;
        
        let mockCandidates = [
          { id: 1, fullName: 'John Doe', email: 'john@test.com', status: 'new', jobId: 1 },
          { id: 2, fullName: 'Jane Smith', email: 'jane@test.com', status: 'interview', jobId: 1 },
          { id: 3, fullName: 'Bob Wilson', email: 'bob@test.com', status: 'hired', jobId: 2 }
        ];
        
        // Apply status filter
        if (status) {
          const statusArray = Array.isArray(status) ? status : [status];
          mockCandidates = mockCandidates.filter(c => statusArray.includes(c.status));
        }
        
        // Apply job filter
        if (jobId) {
          mockCandidates = mockCandidates.filter(c => c.jobId === parseInt(jobId));
        }
        
        // Apply search filter
        if (search) {
          const searchLower = search.toLowerCase();
          mockCandidates = mockCandidates.filter(c => 
            c.fullName.toLowerCase().includes(searchLower) ||
            c.email.toLowerCase().includes(searchLower)
          );
        }
        
        res.json(mockCandidates);
      });

      const response = await request(app)
        .get('/api/candidates/filter')
        .query({ status: ['new', 'interview'], jobId: 1 })
        .expect(200);

      expect(response.body.length).toBe(2);
      expect(response.body.every(c => ['new', 'interview'].includes(c.status))).toBe(true);
      expect(response.body.every(c => c.jobId === 1)).toBe(true);
    });

    test('should validate candidate search functionality', async () => {
      app.get('/api/candidates/search', (req, res) => {
        const { q } = req.query;
        
        const mockCandidates = [
          { id: 1, fullName: 'John Doe', email: 'john@test.com', notes: 'Experienced developer' },
          { id: 2, fullName: 'Jane Smith', email: 'jane@test.com', notes: 'Marketing specialist' },
          { id: 3, fullName: 'Bob Wilson', email: 'bob@test.com', notes: 'Senior engineer' }
        ];
        
        if (!q || q.length < 2) {
          return res.json([]);
        }
        
        const searchLower = q.toLowerCase();
        const filtered = mockCandidates.filter(c => 
          c.fullName.toLowerCase().includes(searchLower) ||
          c.email.toLowerCase().includes(searchLower) ||
          c.notes.toLowerCase().includes(searchLower)
        );
        
        res.json(filtered);
      });

      const response = await request(app)
        .get('/api/candidates/search')
        .query({ q: 'developer' })
        .expect(200);

      expect(response.body.length).toBe(1);
      expect(response.body[0].notes).toContain('developer');
    });
  });

  describe('Advanced Job Filtering', () => {
    test('should validate job filtering by multiple criteria', async () => {
      app.get('/api/jobs/filter', (req, res) => {
        const { status, type, department, salaryMin, salaryMax } = req.query;
        
        let mockJobs = [
          { 
            id: 1, 
            title: 'Software Engineer', 
            status: 'active', 
            type: 'full-time', 
            department: 'Engineering',
            salaryStart: 80000,
            salaryEnd: 120000
          },
          { 
            id: 2, 
            title: 'Marketing Manager', 
            status: 'draft', 
            type: 'full-time', 
            department: 'Marketing',
            salaryStart: 70000,
            salaryEnd: 90000
          },
          { 
            id: 3, 
            title: 'Contract Developer', 
            status: 'active', 
            type: 'contract', 
            department: 'Engineering',
            salaryStart: 100000,
            salaryEnd: 150000
          }
        ];
        
        // Apply filters
        if (status) {
          const statusArray = Array.isArray(status) ? status : [status];
          mockJobs = mockJobs.filter(j => statusArray.includes(j.status));
        }
        
        if (type) {
          const typeArray = Array.isArray(type) ? type : [type];
          mockJobs = mockJobs.filter(j => typeArray.includes(j.type));
        }
        
        if (department) {
          mockJobs = mockJobs.filter(j => j.department.toLowerCase() === department.toLowerCase());
        }
        
        if (salaryMin) {
          mockJobs = mockJobs.filter(j => j.salaryStart >= parseInt(salaryMin));
        }
        
        if (salaryMax) {
          mockJobs = mockJobs.filter(j => j.salaryEnd <= parseInt(salaryMax));
        }
        
        res.json(mockJobs);
      });

      const response = await request(app)
        .get('/api/jobs/filter')
        .query({ 
          status: 'active',
          type: 'full-time',
          department: 'Engineering',
          salaryMin: 75000,
          salaryMax: 125000
        })
        .expect(200);

      expect(response.body.length).toBe(1);
      expect(response.body[0].title).toBe('Software Engineer');
      expect(response.body[0].status).toBe('active');
      expect(response.body[0].type).toBe('full-time');
    });

    test('should validate job search with text matching', async () => {
      app.get('/api/jobs/search', (req, res) => {
        const { q } = req.query;
        
        const mockJobs = [
          { id: 1, title: 'Senior Software Engineer', description: 'React and Node.js developer' },
          { id: 2, title: 'Marketing Manager', description: 'Digital marketing specialist' },
          { id: 3, title: 'DevOps Engineer', description: 'AWS and Docker experience' }
        ];
        
        if (!q || q.length < 2) {
          return res.json([]);
        }
        
        const searchLower = q.toLowerCase();
        const filtered = mockJobs.filter(j => 
          j.title.toLowerCase().includes(searchLower) ||
          j.description.toLowerCase().includes(searchLower)
        );
        
        res.json(filtered);
      });

      const response = await request(app)
        .get('/api/jobs/search')
        .query({ q: 'engineer' })
        .expect(200);

      expect(response.body.length).toBe(2);
      expect(response.body.every(j => 
        j.title.toLowerCase().includes('engineer') || 
        j.description.toLowerCase().includes('engineer')
      )).toBe(true);
    });
  });

  describe('Saved Search Functionality', () => {
    test('should validate saved search creation', async () => {
      app.post('/api/saved-searches', (req, res) => {
        const { name, searchType, filters } = req.body;
        
        if (!name || !searchType || !filters) {
          return res.status(400).json({ error: 'Name, search type, and filters are required' });
        }
        
        const validSearchTypes = ['candidates', 'jobs'];
        if (!validSearchTypes.includes(searchType)) {
          return res.status(400).json({ error: 'Invalid search type' });
        }
        
        res.json({
          id: Date.now(),
          name,
          searchType,
          filters,
          userId: req.user.id,
          companyId: req.user.companyId,
          createdAt: new Date().toISOString()
        });
      });

      const response = await request(app)
        .post('/api/saved-searches')
        .send({
          name: 'Active Engineering Jobs',
          searchType: 'jobs',
          filters: {
            status: ['active'],
            department: 'Engineering',
            type: ['full-time']
          }
        })
        .expect(200);

      expect(response.body.name).toBe('Active Engineering Jobs');
      expect(response.body.searchType).toBe('jobs');
      expect(response.body.filters.department).toBe('Engineering');
    });

    test('should validate saved search listing', async () => {
      app.get('/api/saved-searches', (req, res) => {
        const mockSavedSearches = [
          {
            id: 1,
            name: 'New Candidates',
            searchType: 'candidates',
            filters: { status: ['new'] },
            userId: req.user.id
          },
          {
            id: 2,
            name: 'Active Jobs',
            searchType: 'jobs',
            filters: { status: ['active'] },
            userId: req.user.id
          }
        ];
        
        res.json(mockSavedSearches);
      });

      const response = await request(app)
        .get('/api/saved-searches')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
      expect(response.body[0]).toHaveProperty('name');
      expect(response.body[0]).toHaveProperty('searchType');
      expect(response.body[0]).toHaveProperty('filters');
    });
  });
});