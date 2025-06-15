const request = require('supertest');
const express = require('express');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const { MemStorage } = require('../server/storage');

describe('User Invitation System API', () => {
  let app;
  let storage;
  let mockAdminUser;
  let mockRegularUser;
  let mockCompany;
  let adminSessionCookie;
  let userSessionCookie;

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

    // Import and setup routes
    const routes = await import('../server/routes.js');
    routes.setupRoutes(app);

    // Create test company
    mockCompany = await storage.createCompany({
      name: 'Test Company',
      subdomain: 'testcompany',
      settings: {}
    });

    // Create admin user
    mockAdminUser = await storage.createUser({
      username: 'admin@test.com',
      password: 'hashedpassword',
      companyId: mockCompany.id,
      role: 'admin'
    });

    // Create regular user
    mockRegularUser = await storage.createUser({
      username: 'user@test.com',
      password: 'hashedpassword',
      companyId: mockCompany.id,
      role: 'user'
    });

    // Create admin session
    const adminLogin = await request(app)
      .post('/test-login')
      .send({
        user: mockAdminUser,
        activeTenantId: mockCompany.id
      });
    adminSessionCookie = adminLogin.headers['set-cookie'];

    // Create user session
    const userLogin = await request(app)
      .post('/test-login')
      .send({
        user: mockRegularUser,
        activeTenantId: mockCompany.id
      });
    userSessionCookie = userLogin.headers['set-cookie'];
  });

  describe('POST /api/users/invite', () => {
    it('should allow admin to invite new user successfully', async () => {
      const inviteData = {
        username: 'newuser@test.com',
        role: 'user'
      };

      const response = await request(app)
        .post('/api/users/invite')
        .set('Cookie', adminSessionCookie)
        .send(inviteData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User invited successfully');
      expect(response.body.user).toMatchObject({
        username: 'newuser@test.com',
        role: 'user',
        companyId: mockCompany.id
      });
    });

    it('should allow admin to invite new admin user', async () => {
      const inviteData = {
        username: 'newadmin@test.com',
        role: 'admin'
      };

      const response = await request(app)
        .post('/api/users/invite')
        .set('Cookie', adminSessionCookie)
        .send(inviteData);

      expect(response.status).toBe(200);
      expect(response.body.user.role).toBe('admin');
    });

    it('should default to user role if no role specified', async () => {
      const inviteData = {
        username: 'defaultrole@test.com'
      };

      const response = await request(app)
        .post('/api/users/invite')
        .set('Cookie', adminSessionCookie)
        .send(inviteData);

      expect(response.status).toBe(200);
      expect(response.body.user.role).toBe('user');
    });

    it('should prevent regular users from inviting others', async () => {
      const inviteData = {
        username: 'unauthorized@test.com',
        role: 'user'
      };

      const response = await request(app)
        .post('/api/users/invite')
        .set('Cookie', userSessionCookie)
        .send(inviteData);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Admin access required');
    });

    it('should require authentication', async () => {
      const inviteData = {
        username: 'nologin@test.com',
        role: 'user'
      };

      const response = await request(app)
        .post('/api/users/invite')
        .send(inviteData);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    });

    it('should validate required username field', async () => {
      const inviteData = {
        role: 'user'
      };

      const response = await request(app)
        .post('/api/users/invite')
        .set('Cookie', adminSessionCookie)
        .send(inviteData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Username is required');
    });

    it('should validate role field', async () => {
      const inviteData = {
        username: 'test@test.com',
        role: 'invalidrole'
      };

      const response = await request(app)
        .post('/api/users/invite')
        .set('Cookie', adminSessionCookie)
        .send(inviteData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid role. Must be 'admin' or 'user'");
    });

    it('should prevent inviting existing users', async () => {
      const inviteData = {
        username: 'user@test.com', // Already exists
        role: 'user'
      };

      const response = await request(app)
        .post('/api/users/invite')
        .set('Cookie', adminSessionCookie)
        .send(inviteData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('User already exists in this company');
    });
  });

  describe('GET /api/users/company', () => {
    it('should return all users in the company', async () => {
      // Invite additional user
      await request(app)
        .post('/api/users/invite')
        .set('Cookie', adminSessionCookie)
        .send({
          username: 'invited@test.com',
          role: 'user'
        });

      const response = await request(app)
        .get('/api/users/company')
        .set('Cookie', adminSessionCookie);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(3); // admin + regular + invited

      // Check that sensitive data is not included
      response.body.forEach(user => {
        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('username');
        expect(user).toHaveProperty('role');
        expect(user).toHaveProperty('companyId');
        expect(user).not.toHaveProperty('password');
      });
    });

    it('should allow regular users to view company users', async () => {
      const response = await request(app)
        .get('/api/users/company')
        .set('Cookie', userSessionCookie);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/users/company');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    });

    it('should enforce tenant isolation', async () => {
      // Create second company and user
      const company2 = await storage.createCompany({
        name: 'Other Company',
        subdomain: 'othercompany',
        settings: {}
      });

      const user2 = await storage.createUser({
        username: 'other@company.com',
        password: 'hashedpassword',
        companyId: company2.id,
        role: 'admin'
      });

      // Login as user from second company
      await request(app)
        .post('/test-login')
        .send({
          user: user2,
          activeTenantId: company2.id
        });

      const response = await request(app)
        .get('/api/users/company')
        .set('Cookie', adminSessionCookie);

      // Should only see users from first company
      expect(response.status).toBe(200);
      expect(response.body.length).toBe(2); // Only original admin and regular user
      expect(response.body.every(user => user.companyId === mockCompany.id)).toBe(true);
    });
  });

  describe('DELETE /api/users/:userId', () => {
    let invitedUser;

    beforeEach(async () => {
      // Create a user to delete
      const inviteResponse = await request(app)
        .post('/api/users/invite')
        .set('Cookie', adminSessionCookie)
        .send({
          username: 'todelete@test.com',
          role: 'user'
        });
      
      invitedUser = inviteResponse.body.user;
    });

    it('should allow admin to remove users', async () => {
      const response = await request(app)
        .delete(`/api/users/${invitedUser.id}`)
        .set('Cookie', adminSessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User removed successfully');

      // Verify user is removed
      const usersResponse = await request(app)
        .get('/api/users/company')
        .set('Cookie', adminSessionCookie);

      const userExists = usersResponse.body.some(user => user.id === invitedUser.id);
      expect(userExists).toBe(false);
    });

    it('should prevent regular users from removing others', async () => {
      const response = await request(app)
        .delete(`/api/users/${invitedUser.id}`)
        .set('Cookie', userSessionCookie);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Admin access required');
    });

    it('should prevent users from deleting themselves', async () => {
      const response = await request(app)
        .delete(`/api/users/${mockAdminUser.id}`)
        .set('Cookie', adminSessionCookie);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Cannot delete your own account');
    });

    it('should return 404 for non-existent users', async () => {
      const response = await request(app)
        .delete('/api/users/99999')
        .set('Cookie', adminSessionCookie);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found');
    });

    it('should enforce tenant isolation', async () => {
      // Create user in different company
      const company2 = await storage.createCompany({
        name: 'Other Company',
        subdomain: 'othercompany',
        settings: {}
      });

      const userInOtherCompany = await storage.createUser({
        username: 'other@company.com',
        password: 'hashedpassword',
        companyId: company2.id,
        role: 'user'
      });

      // Try to delete user from other company
      const response = await request(app)
        .delete(`/api/users/${userInOtherCompany.id}`)
        .set('Cookie', adminSessionCookie);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .delete(`/api/users/${invitedUser.id}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    });
  });

  describe('User role permissions', () => {
    it('should maintain role hierarchy', async () => {
      // Admin can invite admin
      const adminInvite = await request(app)
        .post('/api/users/invite')
        .set('Cookie', adminSessionCookie)
        .send({
          username: 'newadmin@test.com',
          role: 'admin'
        });

      expect(adminInvite.status).toBe(200);
      expect(adminInvite.body.user.role).toBe('admin');

      // Regular user cannot invite anyone
      const userInvite = await request(app)
        .post('/api/users/invite')
        .set('Cookie', userSessionCookie)
        .send({
          username: 'shouldfail@test.com',
          role: 'user'
        });

      expect(userInvite.status).toBe(403);
    });
  });

  describe('Data validation and security', () => {
    it('should sanitize user data in responses', async () => {
      const response = await request(app)
        .get('/api/users/company')
        .set('Cookie', adminSessionCookie);

      response.body.forEach(user => {
        expect(user).not.toHaveProperty('password');
        expect(user).toHaveProperty('username');
        expect(user).toHaveProperty('role');
        expect(user).toHaveProperty('companyId');
      });
    });

    it('should handle malformed user IDs in delete endpoint', async () => {
      const response = await request(app)
        .delete('/api/users/notanumber')
        .set('Cookie', adminSessionCookie);

      expect(response.status).toBe(404);
    });
  });
});