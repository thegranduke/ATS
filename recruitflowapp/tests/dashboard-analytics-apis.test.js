const request = require('supertest');
const express = require('express');
const { setupAuth } = require('../server/auth.ts');
const { setupRoutes } = require('../server/routes.ts');
const { storage } = require('../server/storage.ts');

// Mock storage for testing
jest.mock('../server/storage.ts', () => ({
  storage: {
    sessionStore: {
      get: jest.fn(),
      set: jest.fn(),
      destroy: jest.fn(),
      length: jest.fn(),
      clear: jest.fn(),
      touch: jest.fn()
    },
    getJobViewsAnalytics: jest.fn(),
    getTotalJobViewsCount: jest.fn(),
    getJobViewsCountByCompany: jest.fn(),
    getUserByUsername: jest.fn(),
    getUser: jest.fn()
  }
}));

const mockStorage = storage;

describe('Dashboard Analytics APIs', () => {
  let app;
  let mockUser;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Mock authenticated user
    mockUser = {
      id: 1,
      username: 'test@example.com',
      companyId: 1,
      role: 'admin'
    };

    // Mock authentication middleware
    app.use((req, res, next) => {
      req.isAuthenticated = () => true;
      req.user = mockUser;
      next();
    });
    
    // Setup routes
    setupRoutes(app);
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('Job Views Analytics API', () => {
    test('should return job views analytics with month-over-month data', async () => {
      const mockAnalytics = {
        totalViews: 250,
        currentMonthViews: 150,
        lastMonthViews: 100,
        percentageChange: 50,
        trend: 'up'
      };

      mockStorage.getJobViewsAnalytics.mockResolvedValue(mockAnalytics);

      const response = await request(app)
        .get('/api/job-views/analytics/company')
        .expect(200);

      expect(response.body).toEqual(mockAnalytics);
      expect(mockStorage.getJobViewsAnalytics).toHaveBeenCalledWith(
        1, // companyId
        expect.objectContaining({
          currentMonthStart: expect.any(Date),
          lastMonthStart: expect.any(Date),
          lastMonthEnd: expect.any(Date)
        })
      );
    });

    test('should handle analytics calculation errors gracefully', async () => {
      mockStorage.getJobViewsAnalytics.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/job-views/analytics/company')
        .expect(500);

      expect(response.body.error).toBe('Failed to fetch analytics');
    });
  });

  describe('Total Job Views Count API', () => {
    test('should return total job views count', async () => {
      mockStorage.getTotalJobViewsCount.mockResolvedValue(500);

      const response = await request(app)
        .get('/api/job-views/total/company')
        .expect(200);

      expect(response.body).toEqual({ count: 500 });
      expect(mockStorage.getTotalJobViewsCount).toHaveBeenCalledWith(1);
    });

    test('should handle zero views correctly', async () => {
      mockStorage.getTotalJobViewsCount.mockResolvedValue(0);

      const response = await request(app)
        .get('/api/job-views/total/company')
        .expect(200);

      expect(response.body).toEqual({ count: 0 });
    });
  });

  describe('Job Views Count Breakdown API', () => {
    test('should return job views breakdown by job', async () => {
      const mockBreakdown = [
        { jobId: 1, count: 150 },
        { jobId: 2, count: 100 },
        { jobId: 3, count: 75 }
      ];

      mockStorage.getJobViewsCountByCompany.mockResolvedValue(mockBreakdown);

      const response = await request(app)
        .get('/api/job-views/count/company')
        .expect(200);

      expect(response.body).toEqual(mockBreakdown);
      expect(mockStorage.getJobViewsCountByCompany).toHaveBeenCalledWith(1);
    });

    test('should handle empty breakdown correctly', async () => {
      mockStorage.getJobViewsCountByCompany.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/job-views/count/company')
        .expect(200);

      expect(response.body).toEqual([]);
    });
  });

  describe('Authentication Requirements', () => {
    let unauthenticatedApp;

    beforeEach(() => {
      unauthenticatedApp = express();
      unauthenticatedApp.use(express.json());
      
      // Mock unauthenticated user
      unauthenticatedApp.use((req, res, next) => {
        req.isAuthenticated = () => false;
        req.user = null;
        next();
      });
      
      setupRoutes(unauthenticatedApp);
    });

    test('should require authentication for analytics endpoint', async () => {
      await request(unauthenticatedApp)
        .get('/api/job-views/analytics/company')
        .expect(401);
    });

    test('should require authentication for total views endpoint', async () => {
      await request(unauthenticatedApp)
        .get('/api/job-views/total/company')
        .expect(401);
    });

    test('should require authentication for views breakdown endpoint', async () => {
      await request(unauthenticatedApp)
        .get('/api/job-views/count/company')
        .expect(401);
    });
  });
});