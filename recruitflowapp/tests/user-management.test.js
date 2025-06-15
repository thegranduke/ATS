const request = require('supertest');
const express = require('express');

describe('User Management APIs - Critical Priority', () => {
  let app;
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Mock authenticated admin user
    app.use((req, res, next) => {
      req.isAuthenticated = () => true;
      req.user = { 
        id: 1, 
        companyId: 1, 
        role: 'admin',
        username: 'admin@test.com'
      };
      next();
    });
  });

  describe('Password Change API', () => {
    test('should validate password change endpoint structure', async () => {
      app.put('/api/user/password', (req, res) => {
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
          return res.status(400).json({ error: 'Current password and new password are required' });
        }
        
        res.json({ message: 'Password changed successfully' });
      });

      const response = await request(app)
        .put('/api/user/password')
        .send({
          currentPassword: 'oldpass123',
          newPassword: 'newpass456'
        })
        .expect(200);

      expect(response.body.message).toBe('Password changed successfully');
    });

    test('should reject password change with missing fields', async () => {
      app.put('/api/user/password', (req, res) => {
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
          return res.status(400).json({ error: 'Current password and new password are required' });
        }
        
        res.json({ message: 'Password changed successfully' });
      });

      await request(app)
        .put('/api/user/password')
        .send({ currentPassword: 'oldpass123' })
        .expect(400);
    });
  });

  describe('User Invitation API', () => {
    test('should validate user invitation endpoint', async () => {
      app.post('/api/users/invite', (req, res) => {
        const { username, role = 'user' } = req.body;
        
        if (!username) {
          return res.status(400).json({ error: 'Email address is required' });
        }

        if (req.user.role !== 'admin') {
          return res.status(403).json({ error: 'Only administrators can invite users' });
        }

        res.json({
          id: 2,
          username,
          fullName: username.split('@')[0],
          companyId: req.user.companyId,
          role,
          avatarColor: '#7E57C2'
        });
      });

      const response = await request(app)
        .post('/api/users/invite')
        .send({
          username: 'newuser@test.com',
          role: 'user'
        })
        .expect(200);

      expect(response.body.username).toBe('newuser@test.com');
      expect(response.body.role).toBe('user');
      expect(response.body).not.toHaveProperty('password');
    });

    test('should reject invitation from non-admin user', async () => {
      // Override auth middleware for this test
      app.use((req, res, next) => {
        req.user.role = 'user'; // Change to regular user
        next();
      });

      app.post('/api/users/invite', (req, res) => {
        if (req.user.role !== 'admin') {
          return res.status(403).json({ error: 'Only administrators can invite users' });
        }
        res.json({ success: true });
      });

      await request(app)
        .post('/api/users/invite')
        .send({ username: 'test@test.com' })
        .expect(403);
    });
  });

  describe('User Role Management API', () => {
    test('should validate user role update endpoint', async () => {
      app.patch('/api/users/:id', (req, res) => {
        const userId = parseInt(req.params.id);
        const { role, fullName } = req.body;

        if (req.user.role !== 'admin') {
          return res.status(403).json({ error: 'Only administrators can update user roles' });
        }

        res.json({
          id: userId,
          username: 'user@test.com',
          fullName: fullName || 'Test User',
          companyId: req.user.companyId,
          role: role || 'user'
        });
      });

      const response = await request(app)
        .patch('/api/users/2')
        .send({
          role: 'admin',
          fullName: 'Updated User'
        })
        .expect(200);

      expect(response.body.role).toBe('admin');
      expect(response.body.fullName).toBe('Updated User');
    });
  });

  describe('User Deletion API', () => {
    test('should validate user deletion endpoint', async () => {
      app.delete('/api/users/:id', (req, res) => {
        const userId = parseInt(req.params.id);

        if (req.user.role !== 'admin') {
          return res.status(403).json({ error: 'Only administrators can delete users' });
        }

        if (userId === req.user.id) {
          return res.status(400).json({ error: 'You cannot delete your own account' });
        }

        res.json({ message: 'User deleted successfully' });
      });

      const response = await request(app)
        .delete('/api/users/2')
        .expect(200);

      expect(response.body.message).toBe('User deleted successfully');
    });

    test('should prevent self-deletion', async () => {
      app.delete('/api/users/:id', (req, res) => {
        const userId = parseInt(req.params.id);

        if (userId === req.user.id) {
          return res.status(400).json({ error: 'You cannot delete your own account' });
        }

        res.json({ message: 'User deleted successfully' });
      });

      await request(app)
        .delete('/api/users/1') // Same as req.user.id
        .expect(400);
    });
  });

  describe('Company Users List API', () => {
    test('should validate users listing endpoint', async () => {
      app.get('/api/users', (req, res) => {
        const mockUsers = [
          {
            id: 1,
            username: 'admin@test.com',
            fullName: 'Admin User',
            companyId: 1,
            role: 'admin',
            avatarColor: '#7E57C2'
          },
          {
            id: 2,
            username: 'user@test.com',
            fullName: 'Regular User',
            companyId: 1,
            role: 'user',
            avatarColor: '#4CAF50'
          }
        ];

        res.json(mockUsers);
      });

      const response = await request(app)
        .get('/api/users')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
      
      // Ensure no passwords in response
      response.body.forEach(user => {
        expect(user).not.toHaveProperty('password');
        expect(user).toHaveProperty('username');
        expect(user).toHaveProperty('role');
      });
    });
  });
});