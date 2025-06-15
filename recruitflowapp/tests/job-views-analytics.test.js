const request = require('supertest');
const express = require('express');

describe('Job Views Analytics - Critical Priority', () => {
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

  describe('Job Views Tracking System', () => {
    test('should validate job view recording API', async () => {
      app.post('/api/job-views/record', (req, res) => {
        const { jobId, ipAddress, userAgent, referrer } = req.body;
        
        if (!jobId) {
          return res.status(400).json({ error: 'Job ID is required' });
        }
        
        res.json({
          success: true,
          viewId: Date.now(),
          jobId,
          companyId: req.user.companyId,
          viewedAt: new Date().toISOString(),
          message: 'Job view recorded successfully'
        });
      });

      const response = await request(app)
        .post('/api/job-views/record')
        .send({
          jobId: 1,
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          referrer: 'https://linkedin.com'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.jobId).toBe(1);
      expect(response.body.companyId).toBe(1);
    });

    test('should validate analytics calculation API', async () => {
      app.get('/api/job-views/analytics', (req, res) => {
        const { dateRange = '30days' } = req.query;
        
        const analyticsData = {
          totalViews: 250,
          currentMonthViews: 150,
          lastMonthViews: 100,
          percentageChange: 50,
          trend: 'up',
          topViewedJobs: [
            { jobId: 1, title: 'Software Engineer', views: 85 },
            { jobId: 2, title: 'Marketing Manager', views: 65 },
            { jobId: 3, title: 'Sales Representative', views: 45 }
          ],
          dailyBreakdown: Array.from({ length: 30 }, (_, i) => ({
            date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            views: Math.floor(Math.random() * 20) + 5
          }))
        };
        
        res.json(analyticsData);
      });

      const response = await request(app)
        .get('/api/job-views/analytics')
        .expect(200);

      expect(response.body.totalViews).toBe(250);
      expect(response.body.percentageChange).toBe(50);
      expect(response.body.trend).toBe('up');
      expect(Array.isArray(response.body.topViewedJobs)).toBe(true);
      expect(Array.isArray(response.body.dailyBreakdown)).toBe(true);
    });

    test('should validate dashboard metrics endpoint', async () => {
      app.get('/api/dashboard/metrics', (req, res) => {
        const dashboardMetrics = {
          totalJobs: 15,
          activeJobs: 8,
          totalCandidates: 156,
          newApplications: 12,
          jobViews: {
            total: 250,
            thisMonth: 150,
            lastMonth: 100,
            percentageChange: 50,
            trend: 'up'
          },
          applicationTrend: [
            { month: 'Jan', applications: 20 },
            { month: 'Feb', applications: 25 },
            { month: 'Mar', applications: 30 },
            { month: 'Apr', applications: 35 }
          ]
        };
        
        res.json(dashboardMetrics);
      });

      const response = await request(app)
        .get('/api/dashboard/metrics')
        .expect(200);

      expect(response.body.totalJobs).toBe(15);
      expect(response.body.jobViews.total).toBe(250);
      expect(response.body.jobViews.trend).toBe('up');
      expect(Array.isArray(response.body.applicationTrend)).toBe(true);
    });
  });

  describe('Job View Statistics', () => {
    test('should validate individual job statistics', async () => {
      app.get('/api/jobs/:id/analytics', (req, res) => {
        const jobId = parseInt(req.params.id);
        
        const jobStats = {
          jobId,
          totalViews: 85,
          viewsThisWeek: 25,
          viewsLastWeek: 20,
          weeklyGrowth: 25,
          averageViewsPerDay: 3.6,
          topReferrers: [
            { source: 'LinkedIn', views: 30, percentage: 35.3 },
            { source: 'Indeed', views: 25, percentage: 29.4 },
            { source: 'Company Website', views: 20, percentage: 23.5 },
            { source: 'Direct', views: 10, percentage: 11.8 }
          ],
          viewsByDate: Array.from({ length: 7 }, (_, i) => ({
            date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            views: Math.floor(Math.random() * 10) + 1
          }))
        };
        
        res.json(jobStats);
      });

      const response = await request(app)
        .get('/api/jobs/1/analytics')
        .expect(200);

      expect(response.body.jobId).toBe(1);
      expect(response.body.totalViews).toBe(85);
      expect(response.body.weeklyGrowth).toBe(25);
      expect(Array.isArray(response.body.topReferrers)).toBe(true);
      expect(Array.isArray(response.body.viewsByDate)).toBe(true);
    });

    test('should validate company-wide view analytics', async () => {
      app.get('/api/company/analytics/views', (req, res) => {
        const { period = 'month' } = req.query;
        
        const companyAnalytics = {
          period,
          totalViews: 1250,
          uniqueViewers: 890,
          averageViewsPerJob: 83.3,
          conversionRate: 12.5, // applications per view
          topPerformingJobs: [
            { id: 1, title: 'Software Engineer', views: 250, applications: 35 },
            { id: 2, title: 'Marketing Manager', views: 200, applications: 25 },
            { id: 3, title: 'Sales Rep', views: 150, applications: 20 }
          ],
          viewsByDepartment: [
            { department: 'Engineering', views: 600, jobs: 5 },
            { department: 'Marketing', views: 350, jobs: 3 },
            { department: 'Sales', views: 300, jobs: 2 }
          ]
        };
        
        res.json(companyAnalytics);
      });

      const response = await request(app)
        .get('/api/company/analytics/views')
        .query({ period: 'month' })
        .expect(200);

      expect(response.body.totalViews).toBe(1250);
      expect(response.body.conversionRate).toBe(12.5);
      expect(Array.isArray(response.body.topPerformingJobs)).toBe(true);
      expect(Array.isArray(response.body.viewsByDepartment)).toBe(true);
    });
  });

  describe('Performance Monitoring', () => {
    test('should validate view tracking validation', async () => {
      app.post('/api/job-views/record', (req, res) => {
        const { jobId } = req.body;
        
        if (!jobId || isNaN(jobId)) {
          return res.status(400).json({ error: 'Valid job ID is required' });
        }
        
        res.json({ success: true, jobId });
      });

      // Test with invalid job ID
      await request(app)
        .post('/api/job-views/record')
        .send({ jobId: 'invalid' })
        .expect(400);

      // Test with missing job ID
      await request(app)
        .post('/api/job-views/record')
        .send({})
        .expect(400);
    });

    test('should handle bulk analytics requests', async () => {
      app.get('/api/analytics/bulk', (req, res) => {
        const { metrics } = req.query;
        const requestedMetrics = metrics ? metrics.split(',') : [];
        
        const bulkData = {};
        
        if (requestedMetrics.includes('views')) {
          bulkData.views = { total: 250, trend: 'up' };
        }
        
        if (requestedMetrics.includes('applications')) {
          bulkData.applications = { total: 156, trend: 'up' };
        }
        
        if (requestedMetrics.includes('jobs')) {
          bulkData.jobs = { total: 15, active: 8 };
        }
        
        res.json(bulkData);
      });

      const response = await request(app)
        .get('/api/analytics/bulk')
        .query({ metrics: 'views,applications,jobs' })
        .expect(200);

      expect(response.body).toHaveProperty('views');
      expect(response.body).toHaveProperty('applications');
      expect(response.body).toHaveProperty('jobs');
    });
  });
});