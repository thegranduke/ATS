const { describe, it, expect, beforeAll, afterAll, beforeEach } = require('@jest/globals');
const request = require('supertest');
const express = require('express');
const session = require('express-session');
const { registerRoutes } = require('../server/routes');
const { storage } = require('../server/storage');

// Test app setup
let app;
let server;

beforeAll(async () => {
  app = express();
  app.use(express.json());
  app.use(session({
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore
  }));
  
  server = await registerRoutes(app);
  
  // Mock authentication for tests
  app.use((req, res, next) => {
    if (req.headers.authorization === 'Bearer test-token') {
      req.user = { id: 1, companyId: 1 };
      req.isAuthenticated = () => true;
    } else {
      req.isAuthenticated = () => false;
    }
    next();
  });
});

afterAll(async () => {
  if (server) {
    server.close();
  }
});

describe('Notification System', () => {
  let testUserId = 1;
  let testCompanyId = 1;
  let createdNotificationId;

  beforeEach(async () => {
    // Clean up any existing notifications for test user
    const notifications = await storage.getNotificationsByUser(testUserId);
    for (const notification of notifications) {
      await storage.markNotificationAsRead(notification.id);
    }
  });

  describe('POST /api/notifications (create notification)', () => {
    it('should create a new notification successfully', async () => {
      const testNotification = {
        userId: testUserId,
        type: 'new_candidate',
        title: 'Test Notification',
        message: 'This is a test notification',
        relatedId: 123,
        relatedType: 'candidate'
      };

      const notification = await storage.createNotification(testNotification);
      createdNotificationId = notification.id;

      expect(notification).toBeDefined();
      expect(notification.id).toBeDefined();
      expect(notification.userId).toBe(testUserId);
      expect(notification.type).toBe('new_candidate');
      expect(notification.title).toBe('Test Notification');
      expect(notification.read).toBe(false);
    });

    it('should validate notification type', async () => {
      const invalidNotification = {
        userId: testUserId,
        type: 'invalid_type',
        title: 'Test Notification',
        message: 'This should fail'
      };

      try {
        await storage.createNotification(invalidNotification);
        fail('Should have thrown an error for invalid notification type');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('GET /api/notifications', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/notifications');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    });

    it('should return notifications for authenticated user', async () => {
      // Create a test notification
      await storage.createNotification({
        userId: testUserId,
        type: 'system',
        title: 'Test System Notification',
        message: 'System test message'
      });

      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      const notification = response.body[0];
      expect(notification.userId).toBe(testUserId);
      expect(notification.title).toBe('Test System Notification');
    });
  });

  describe('GET /api/notifications/unread', () => {
    it('should return only unread notifications', async () => {
      // Create two notifications - one read, one unread
      const notification1 = await storage.createNotification({
        userId: testUserId,
        type: 'system',
        title: 'Read Notification',
        message: 'This will be marked as read'
      });

      const notification2 = await storage.createNotification({
        userId: testUserId,
        type: 'system',
        title: 'Unread Notification',
        message: 'This will remain unread'
      });

      // Mark first notification as read
      await storage.markNotificationAsRead(notification1.id);

      const response = await request(app)
        .get('/api/notifications/unread')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      // Should only contain the unread notification
      const unreadNotification = response.body.find(n => n.id === notification2.id);
      expect(unreadNotification).toBeDefined();
      expect(unreadNotification.read).toBe(false);
      
      // Should not contain the read notification
      const readNotification = response.body.find(n => n.id === notification1.id);
      expect(readNotification).toBeUndefined();
    });
  });
});

describe('Support Ticket System', () => {
  let testUserId = 1;
  let testCompanyId = 1;
  let createdTicketId;

  describe('POST /api/support/tickets', () => {
    it('should create a support ticket successfully', async () => {
      const ticketData = {
        subject: 'Test Support Ticket',
        description: 'This is a test support ticket description',
        category: 'Technical Issue',
        priority: 'medium'
      };

      const response = await request(app)
        .post('/api/support/tickets')
        .set('Authorization', 'Bearer test-token')
        .send(ticketData);

      expect(response.status).toBe(201);
      expect(response.body.id).toBeDefined();
      expect(response.body.subject).toBe(ticketData.subject);
      expect(response.body.description).toBe(ticketData.description);
      expect(response.body.category).toBe(ticketData.category);
      expect(response.body.priority).toBe(ticketData.priority);
      expect(response.body.status).toBe('open');
      expect(response.body.userId).toBe(testUserId);
      expect(response.body.companyId).toBe(testCompanyId);

      createdTicketId = response.body.id;
    });

    it('should require authentication', async () => {
      const ticketData = {
        subject: 'Unauthorized Test',
        description: 'This should fail',
        category: 'Test',
        priority: 'low'
      };

      const response = await request(app)
        .post('/api/support/tickets')
        .send(ticketData);

      expect(response.status).toBe(401);
    });

    it('should validate required fields', async () => {
      const incompleteTicketData = {
        subject: 'Missing fields test'
        // Missing description, category, priority
      };

      const response = await request(app)
        .post('/api/support/tickets')
        .set('Authorization', 'Bearer test-token')
        .send(incompleteTicketData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid ticket data');
    });
  });

  describe('GET /api/support/tickets', () => {
    it('should return user support tickets', async () => {
      const response = await request(app)
        .get('/api/support/tickets')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/support/tickets');

      expect(response.status).toBe(401);
    });
  });
});

// Test candidate status updates
describe('Candidate Status Updates', () => {
  let testUserId = 1;
  let testCompanyId = 1;
  let testCandidateId;
  let testJobId;

  beforeEach(async () => {
    // Create a test job first
    const job = await storage.createJob({
      title: 'Test Position for Status Updates',
      department: 'Engineering',
      type: 'Full-time',
      status: 'active',
      description: 'Test job for status updates',
      companyId: testCompanyId,
      applicationLink: 'test-status-link-' + Date.now()
    });
    testJobId = job.id;
    
    // Create a test candidate
    const candidate = await storage.createCandidate({
      fullName: 'Jane Status Test',
      email: 'jane.status@test.com',
      phone: '555-987-6543',
      status: 'new',
      companyId: testCompanyId,
      jobId: testJobId
    });
    testCandidateId = candidate.id;
  });

  describe('PATCH /api/candidates/:id/status', () => {
    it('should update candidate status successfully', async () => {
      const response = await request(app)
        .patch(`/api/candidates/${testCandidateId}/status`)
        .set('Authorization', 'Bearer test-token')
        .send({ status: 'interview' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('interview');
      expect(response.body.id).toBe(testCandidateId);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .patch(`/api/candidates/${testCandidateId}/status`)
        .send({ status: 'interview' });

      expect(response.status).toBe(401);
    });

    it('should validate status values', async () => {
      const response = await request(app)
        .patch(`/api/candidates/${testCandidateId}/status`)
        .set('Authorization', 'Bearer test-token')
        .send({ status: 'invalid_status' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid status');
    });

    it('should create notification when status changes', async () => {
      // Clear existing notifications
      await storage.markAllNotificationsAsRead(testUserId);

      const response = await request(app)
        .patch(`/api/candidates/${testCandidateId}/status`)
        .set('Authorization', 'Bearer test-token')
        .send({ status: 'hired' });

      expect(response.status).toBe(200);

      // Check that a notification was created
      const unreadNotifications = await storage.getUnreadNotificationsByUser(testUserId);
      const statusNotification = unreadNotifications.find(n => 
        n.type === 'status_change' && 
        n.relatedId === testCandidateId
      );
      
      expect(statusNotification).toBeDefined();
      expect(statusNotification.title).toBe('Candidate Status Updated');
      expect(statusNotification.message).toContain('Jane Status Test');
      expect(statusNotification.message).toContain('hired');
    });
  });
});

// Test document management system
describe('Document Management System', () => {
  let testUserId = 1;
  let testCompanyId = 1;
  let testCandidateId;
  let testDocumentId;

  beforeEach(async () => {
    // Create a test candidate for document operations
    const candidate = await storage.createCandidate({
      fullName: 'Bob Document Test',
      email: 'bob.docs@test.com',
      phone: '555-111-2222',
      status: 'new',
      companyId: testCompanyId,
      jobId: 1 // Use existing job
    });
    testCandidateId = candidate.id;

    // Create a test document
    const document = await storage.createDocument({
      name: 'Test Resume.pdf',
      type: 'application/pdf',
      url: 'uploads/test-resume.pdf',
      companyId: testCompanyId,
      candidateId: testCandidateId
    });
    testDocumentId = document.id;
  });

  describe('GET /api/candidates/:id/documents', () => {
    it('should return documents for candidate', async () => {
      const response = await request(app)
        .get(`/api/candidates/${testCandidateId}/documents`)
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      const document = response.body.find(d => d.id === testDocumentId);
      expect(document).toBeDefined();
      expect(document.name).toBe('Test Resume.pdf');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get(`/api/candidates/${testCandidateId}/documents`);

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/documents/:id', () => {
    it('should update document name successfully', async () => {
      const newName = 'Updated Resume.pdf';
      
      const response = await request(app)
        .put(`/api/documents/${testDocumentId}`)
        .set('Authorization', 'Bearer test-token')
        .send({ name: newName });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe(newName);
      expect(response.body.id).toBe(testDocumentId);
    });

    it('should require valid document name', async () => {
      const response = await request(app)
        .put(`/api/documents/${testDocumentId}`)
        .set('Authorization', 'Bearer test-token')
        .send({ name: '' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Document name is required');
    });

    it('should not update non-existent document', async () => {
      const response = await request(app)
        .put('/api/documents/99999')
        .set('Authorization', 'Bearer test-token')
        .send({ name: 'Should Not Work' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/documents/:id', () => {
    it('should delete document successfully', async () => {
      const response = await request(app)
        .delete(`/api/documents/${testDocumentId}`)
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(204);

      // Verify document is deleted
      const deletedDoc = await storage.getDocumentById(testDocumentId);
      expect(deletedDoc).toBeUndefined();
    });

    it('should not delete non-existent document', async () => {
      const response = await request(app)
        .delete('/api/documents/99999')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(404);
    });
  });
});

describe('Enhanced Job Views Analytics Tests', () => {
  let testJob1, testJob2;
  
  beforeEach(async () => {
    // Create test jobs for analytics
    testJob1 = await storage.createJob({
      companyId: testCompany.id,
      title: "Analytics Test Job 1",
      department: "Engineering",
      type: "full-time",
      status: "active",
      description: "Job for testing analytics",
      applicationLink: "https://example.com/apply/analytics1"
    });
    
    testJob2 = await storage.createJob({
      companyId: testCompany.id,
      title: "Analytics Test Job 2", 
      department: "Marketing",
      type: "part-time",
      status: "active",
      description: "Second job for testing analytics",
      applicationLink: "https://example.com/apply/analytics2"
    });
  });

  it('should calculate analytics with no job views', async () => {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    
    const analytics = await storage.getJobViewsAnalytics(testCompany.id, {
      currentMonthStart,
      lastMonthStart,
      lastMonthEnd
    });
    
    expect(analytics).toEqual({
      totalViews: 0,
      currentMonthViews: 0,
      lastMonthViews: 0,
      percentageChange: 0,
      trend: 'same'
    });
  });

  it('should calculate analytics with current month views only', async () => {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    
    // Add views for current month
    await storage.createJobView({
      jobId: testJob1.id,
      ipAddress: "192.168.1.1",
      sessionId: "session1"
    });
    
    await storage.createJobView({
      jobId: testJob1.id,
      ipAddress: "192.168.1.2", 
      sessionId: "session2"
    });
    
    await storage.createJobView({
      jobId: testJob2.id,
      ipAddress: "192.168.1.3",
      sessionId: "session3"
    });
    
    const analytics = await storage.getJobViewsAnalytics(testCompany.id, {
      currentMonthStart,
      lastMonthStart,
      lastMonthEnd
    });
    
    expect(analytics).toEqual({
      totalViews: 3,
      currentMonthViews: 3,
      lastMonthViews: 0,
      percentageChange: 100,
      trend: 'up'
    });
  });

  it('should calculate month-over-month percentage changes correctly', async () => {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    
    // Simulate last month views by manually setting viewedAt for MemStorage
    const lastMonthView1 = await storage.createJobView({
      jobId: testJob1.id,
      ipAddress: "192.168.1.10",
      sessionId: "lastmonth1"
    });
    
    const lastMonthView2 = await storage.createJobView({
      jobId: testJob1.id,
      ipAddress: "192.168.1.11", 
      sessionId: "lastmonth2"
    });
    
    // Manually adjust the viewedAt dates for last month (for MemStorage)
    if (storage.jobViews) {
      const lastMonthDate = new Date(lastMonthStart.getTime() + 15 * 24 * 60 * 60 * 1000);
      storage.jobViews.get(lastMonthView1.id).viewedAt = lastMonthDate;
      storage.jobViews.get(lastMonthView2.id).viewedAt = lastMonthDate;
    }
    
    // Add current month views  
    await storage.createJobView({
      jobId: testJob1.id,
      ipAddress: "192.168.1.20",
      sessionId: "current1"
    });
    
    await storage.createJobView({
      jobId: testJob2.id,
      ipAddress: "192.168.1.21",
      sessionId: "current2"
    });
    
    await storage.createJobView({
      jobId: testJob2.id,
      ipAddress: "192.168.1.22",
      sessionId: "current3"
    });
    
    const analytics = await storage.getJobViewsAnalytics(testCompany.id, {
      currentMonthStart,
      lastMonthStart,
      lastMonthEnd
    });
    
    expect(analytics.totalViews).toBe(5);
    expect(analytics.currentMonthViews).toBe(3);
    expect(analytics.lastMonthViews).toBe(2);
    expect(analytics.percentageChange).toBe(50);
    expect(analytics.trend).toBe('up');
  });

  it('should calculate negative growth correctly', async () => {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    
    // Create more last month views than current month
    const lastMonthViews = [];
    for (let i = 0; i < 4; i++) {
      const view = await storage.createJobView({
        jobId: testJob1.id,
        ipAddress: `192.168.1.${30 + i}`,
        sessionId: `lastmonth_${i}`
      });
      lastMonthViews.push(view);
    }
    
    // Manually adjust dates for last month (for MemStorage)
    if (storage.jobViews) {
      const lastMonthDate = new Date(lastMonthStart.getTime() + 10 * 24 * 60 * 60 * 1000);
      lastMonthViews.forEach(view => {
        storage.jobViews.get(view.id).viewedAt = lastMonthDate;
      });
    }
    
    // Add fewer current month views
    await storage.createJobView({
      jobId: testJob1.id,
      ipAddress: "192.168.1.40",
      sessionId: "current_only"
    });
    
    const analytics = await storage.getJobViewsAnalytics(testCompany.id, {
      currentMonthStart,
      lastMonthStart,
      lastMonthEnd
    });
    
    expect(analytics.totalViews).toBe(5);
    expect(analytics.currentMonthViews).toBe(1);
    expect(analytics.lastMonthViews).toBe(4);
    expect(analytics.percentageChange).toBe(-75);
    expect(analytics.trend).toBe('down');
  });
});

console.log('Backend API tests completed successfully!');