const request = require('supertest');
const express = require('express');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const { setupIntegrationRoutes } = require('../server/integration');
const { MemStorage } = require('../server/storage');

describe('Integration Management API', () => {
  let app;
  let storage;
  let mockUser;
  let mockCompany;
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

    // Setup routes
    setupIntegrationRoutes(app);

    // Create test company and user
    mockCompany = await storage.createCompany({
      name: 'Test Company',
      subdomain: 'testcompany',
      settings: {}
    });

    mockUser = await storage.createUser({
      username: 'testadmin',
      password: 'hashedpassword',
      companyId: mockCompany.id,
      role: 'admin'
    });

    // Create authenticated session
    const loginResponse = await request(app)
      .post('/test-login')
      .send({
        user: mockUser,
        activeTenantId: mockCompany.id
      });

    // Setup test login endpoint for session creation
    app.post('/test-login', (req, res) => {
      req.session.user = req.body.user;
      req.session.activeTenantId = req.body.activeTenantId;
      res.json({ success: true });
    });

    sessionCookie = loginResponse.headers['set-cookie'];
  });

  describe('GET /api/integrations', () => {
    it('should return empty array when no integrations exist', async () => {
      const response = await request(app)
        .get('/api/integrations')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/integrations');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    });
  });

  describe('POST /api/integrations/brokerkit', () => {
    const validIntegrationData = {
      name: 'Test Brokerkit Integration',
      apiKey: 'test-api-key-123456789',
      baseUrl: 'https://api.brokerkit.com',
      enabled: true,
      settings: {
        autoSync: true,
        syncFrequency: 'daily'
      }
    };

    it('should create new Brokerkit integration successfully', async () => {
      const response = await request(app)
        .post('/api/integrations/brokerkit')
        .set('Cookie', sessionCookie)
        .send(validIntegrationData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Integration created successfully');
      expect(response.body.integration).toMatchObject({
        name: validIntegrationData.name,
        apiKey: validIntegrationData.apiKey,
        baseUrl: validIntegrationData.baseUrl,
        enabled: validIntegrationData.enabled,
        companyId: mockCompany.id
      });
    });

    it('should update existing Brokerkit integration', async () => {
      // Create initial integration
      await request(app)
        .post('/api/integrations/brokerkit')
        .set('Cookie', sessionCookie)
        .send(validIntegrationData);

      // Update the integration
      const updatedData = {
        ...validIntegrationData,
        name: 'Updated Brokerkit Integration',
        enabled: false
      };

      const response = await request(app)
        .post('/api/integrations/brokerkit')
        .set('Cookie', sessionCookie)
        .send(updatedData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Integration updated successfully');
      expect(response.body.integration.name).toBe('Updated Brokerkit Integration');
      expect(response.body.integration.enabled).toBe(false);
    });

    it('should require admin role', async () => {
      // Create regular user
      const regularUser = await storage.createUser({
        username: 'regularuser',
        password: 'hashedpassword',
        companyId: mockCompany.id,
        role: 'user'
      });

      // Login as regular user
      await request(app)
        .post('/test-login')
        .send({
          user: regularUser,
          activeTenantId: mockCompany.id
        });

      const response = await request(app)
        .post('/api/integrations/brokerkit')
        .set('Cookie', sessionCookie)
        .send(validIntegrationData);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Admin access required');
    });

    it('should validate required fields', async () => {
      const invalidData = {
        name: 'Test Integration'
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/integrations/brokerkit')
        .set('Cookie', sessionCookie)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid integration data');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/integrations/brokerkit')
        .send(validIntegrationData);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    });
  });

  describe('GET /api/integrations/brokerkit', () => {
    it('should return 404 when no integration exists', async () => {
      const response = await request(app)
        .get('/api/integrations/brokerkit')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('No Brokerkit integration found');
    });

    it('should return integration when it exists', async () => {
      const integrationData = {
        name: 'Test Brokerkit Integration',
        apiKey: 'test-api-key-123456789',
        baseUrl: 'https://api.brokerkit.com',
        enabled: true,
        settings: {}
      };

      // Create integration first
      await request(app)
        .post('/api/integrations/brokerkit')
        .set('Cookie', sessionCookie)
        .send(integrationData);

      const response = await request(app)
        .get('/api/integrations/brokerkit')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        name: integrationData.name,
        apiKey: integrationData.apiKey,
        baseUrl: integrationData.baseUrl,
        enabled: integrationData.enabled,
        companyId: mockCompany.id
      });
    });
  });

  describe('POST /api/integrations/brokerkit/test', () => {
    it('should test connection successfully with valid credentials', async () => {
      const integrationData = {
        name: 'Test Brokerkit Integration',
        apiKey: 'test-api-key-123456789',
        baseUrl: 'https://api.brokerkit.com',
        enabled: true,
        settings: {}
      };

      // Create integration first
      await request(app)
        .post('/api/integrations/brokerkit')
        .set('Cookie', sessionCookie)
        .send(integrationData);

      const response = await request(app)
        .post('/api/integrations/brokerkit/test')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Connection test successful');
      expect(response.body.details).toHaveProperty('endpoint');
      expect(response.body.details).toHaveProperty('authenticated');
    });

    it('should fail test with invalid API key', async () => {
      const integrationData = {
        name: 'Test Integration',
        apiKey: 'short', // Invalid API key format
        baseUrl: 'https://api.brokerkit.com',
        enabled: true,
        settings: {}
      };

      // Create integration first
      await request(app)
        .post('/api/integrations/brokerkit')
        .set('Cookie', sessionCookie)
        .send(integrationData);

      const response = await request(app)
        .post('/api/integrations/brokerkit/test')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid API key format');
    });

    it('should return 404 when no integration exists', async () => {
      const response = await request(app)
        .post('/api/integrations/brokerkit/test')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('No Brokerkit integration configured');
    });
  });

  describe('DELETE /api/integrations/brokerkit', () => {
    it('should delete integration successfully', async () => {
      const integrationData = {
        name: 'Test Brokerkit Integration',
        apiKey: 'test-api-key-123456789',
        baseUrl: 'https://api.brokerkit.com',
        enabled: true,
        settings: {}
      };

      // Create integration first
      await request(app)
        .post('/api/integrations/brokerkit')
        .set('Cookie', sessionCookie)
        .send(integrationData);

      const response = await request(app)
        .delete('/api/integrations/brokerkit')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Integration deleted successfully');

      // Verify integration is deleted
      const getResponse = await request(app)
        .get('/api/integrations/brokerkit')
        .set('Cookie', sessionCookie);

      expect(getResponse.status).toBe(404);
    });

    it('should require admin role for deletion', async () => {
      // Create regular user
      const regularUser = await storage.createUser({
        username: 'regularuser2',
        password: 'hashedpassword',
        companyId: mockCompany.id,
        role: 'user'
      });

      // Login as regular user
      await request(app)
        .post('/test-login')
        .send({
          user: regularUser,
          activeTenantId: mockCompany.id
        });

      const response = await request(app)
        .delete('/api/integrations/brokerkit')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Admin access required');
    });
  });

  describe('POST /api/integrations/brokerkit/sync', () => {
    it('should sync jobs successfully when integration is enabled', async () => {
      const integrationData = {
        name: 'Test Brokerkit Integration',
        apiKey: 'test-api-key-123456789',
        baseUrl: 'https://api.brokerkit.com',
        enabled: true,
        settings: {}
      };

      // Create integration
      await request(app)
        .post('/api/integrations/brokerkit')
        .set('Cookie', sessionCookie)
        .send(integrationData);

      // Create test jobs
      const job1 = await storage.createJob({
        title: 'Software Engineer',
        department: 'Engineering',
        companyId: mockCompany.id,
        status: 'active',
        type: 'full-time',
        description: 'Test job 1',
        applicationLink: 'https://company.com/apply/1'
      });

      const job2 = await storage.createJob({
        title: 'Product Manager',
        department: 'Product',
        companyId: mockCompany.id,
        status: 'active',
        type: 'full-time',
        description: 'Test job 2',
        applicationLink: 'https://company.com/apply/2'
      });

      const response = await request(app)
        .post('/api/integrations/brokerkit/sync')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Synced 2 jobs to Brokerkit');
      expect(response.body.summary.total).toBe(2);
      expect(response.body.summary.successful).toBe(2);
      expect(response.body.summary.failed).toBe(0);
      expect(response.body.results).toHaveLength(2);
    });

    it('should return error when integration is not enabled', async () => {
      const integrationData = {
        name: 'Test Brokerkit Integration',
        apiKey: 'test-api-key-123456789',
        baseUrl: 'https://api.brokerkit.com',
        enabled: false, // Disabled
        settings: {}
      };

      // Create disabled integration
      await request(app)
        .post('/api/integrations/brokerkit')
        .set('Cookie', sessionCookie)
        .send(integrationData);

      const response = await request(app)
        .post('/api/integrations/brokerkit/sync')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Brokerkit integration not enabled');
    });

    it('should handle companies with no jobs', async () => {
      const integrationData = {
        name: 'Test Brokerkit Integration',
        apiKey: 'test-api-key-123456789',
        baseUrl: 'https://api.brokerkit.com',
        enabled: true,
        settings: {}
      };

      // Create integration
      await request(app)
        .post('/api/integrations/brokerkit')
        .set('Cookie', sessionCookie)
        .send(integrationData);

      const response = await request(app)
        .post('/api/integrations/brokerkit/sync')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Synced 0 jobs to Brokerkit');
      expect(response.body.summary.total).toBe(0);
    });
  });

  describe('Tenant isolation', () => {
    it('should only access integrations from the user\'s company', async () => {
      // Create second company and user
      const company2 = await storage.createCompany({
        name: 'Second Company',
        subdomain: 'secondcompany',
        settings: {}
      });

      const user2 = await storage.createUser({
        username: 'user2',
        password: 'hashedpassword',
        companyId: company2.id,
        role: 'admin'
      });

      // Create integration for first company
      const integrationData = {
        name: 'Company 1 Integration',
        apiKey: 'company1-api-key',
        baseUrl: 'https://api.brokerkit.com',
        enabled: true,
        settings: {}
      };

      await request(app)
        .post('/api/integrations/brokerkit')
        .set('Cookie', sessionCookie)
        .send(integrationData);

      // Login as user from second company
      await request(app)
        .post('/test-login')
        .send({
          user: user2,
          activeTenantId: company2.id
        });

      // Should not see integration from first company
      const response = await request(app)
        .get('/api/integrations/brokerkit')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('No Brokerkit integration found');
    });
  });
});