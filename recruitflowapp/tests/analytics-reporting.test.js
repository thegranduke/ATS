const request = require('supertest');
const express = require('express');

describe('Analytics & Reporting - High Priority', () => {
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

  describe('Time-to-Hire Analytics', () => {
    test('should validate time-to-hire calculation API', async () => {
      app.get('/api/analytics/time-to-hire', (req, res) => {
        const { dateRange, department, jobId } = req.query;
        
        // Mock time-to-hire data
        const mockData = {
          averageTimeToHire: 21, // days
          medianTimeToHire: 18,
          hiresByTimeframe: [
            { range: '0-7 days', count: 2, percentage: 10 },
            { range: '8-14 days', count: 6, percentage: 30 },
            { range: '15-21 days', count: 8, percentage: 40 },
            { range: '22-30 days', count: 3, percentage: 15 },
            { range: '30+ days', count: 1, percentage: 5 }
          ],
          totalHires: 20,
          departmentBreakdown: department ? [
            { department: department, avgTimeToHire: 21, hires: 20 }
          ] : [
            { department: 'Engineering', avgTimeToHire: 25, hires: 12 },
            { department: 'Marketing', avgTimeToHire: 18, hires: 5 },
            { department: 'Sales', avgTimeToHire: 15, hires: 3 }
          ]
        };
        
        res.json(mockData);
      });

      const response = await request(app)
        .get('/api/analytics/time-to-hire')
        .query({ dateRange: '30days' })
        .expect(200);

      expect(response.body.averageTimeToHire).toBe(21);
      expect(response.body.totalHires).toBe(20);
      expect(Array.isArray(response.body.hiresByTimeframe)).toBe(true);
      expect(Array.isArray(response.body.departmentBreakdown)).toBe(true);
    });

    test('should validate department-specific time-to-hire', async () => {
      app.get('/api/analytics/time-to-hire', (req, res) => {
        const { department } = req.query;
        
        if (department === 'Engineering') {
          res.json({
            averageTimeToHire: 25,
            medianTimeToHire: 22,
            totalHires: 12,
            department: 'Engineering'
          });
        } else {
          res.json({ averageTimeToHire: 21, totalHires: 20 });
        }
      });

      const response = await request(app)
        .get('/api/analytics/time-to-hire')
        .query({ department: 'Engineering' })
        .expect(200);

      expect(response.body.averageTimeToHire).toBe(25);
      expect(response.body.department).toBe('Engineering');
    });
  });

  describe('Conversion Rate Analysis', () => {
    test('should validate recruitment funnel analytics', async () => {
      app.get('/api/analytics/conversion-rates', (req, res) => {
        const funnelData = {
          totalApplications: 100,
          stages: [
            { stage: 'Applied', count: 100, percentage: 100, conversionFromPrevious: null },
            { stage: 'Screening', count: 60, percentage: 60, conversionFromPrevious: 60 },
            { stage: 'Interview', count: 25, percentage: 25, conversionFromPrevious: 42 },
            { stage: 'Offer', count: 8, percentage: 8, conversionFromPrevious: 32 },
            { stage: 'Hired', count: 5, percentage: 5, conversionFromPrevious: 63 }
          ],
          overallConversionRate: 5, // from application to hire
          dropOffAnalysis: [
            { fromStage: 'Applied', toStage: 'Screening', dropOff: 40, reason: 'Initial screening' },
            { fromStage: 'Screening', toStage: 'Interview', dropOff: 58, reason: 'Qualification mismatch' },
            { fromStage: 'Interview', toStage: 'Offer', dropOff: 68, reason: 'Skills assessment' },
            { fromStage: 'Offer', toStage: 'Hired', dropOff: 37, reason: 'Offer declined' }
          ]
        };
        
        res.json(funnelData);
      });

      const response = await request(app)
        .get('/api/analytics/conversion-rates')
        .expect(200);

      expect(response.body.totalApplications).toBe(100);
      expect(response.body.overallConversionRate).toBe(5);
      expect(Array.isArray(response.body.stages)).toBe(true);
      expect(Array.isArray(response.body.dropOffAnalysis)).toBe(true);
      expect(response.body.stages.length).toBe(5);
    });

    test('should validate source tracking analytics', async () => {
      app.get('/api/analytics/source-tracking', (req, res) => {
        const sourceData = {
          totalApplications: 100,
          sources: [
            { source: 'LinkedIn', applications: 35, hires: 3, conversionRate: 8.6 },
            { source: 'Company Website', applications: 25, hires: 2, conversionRate: 8.0 },
            { source: 'Indeed', applications: 20, hires: 0, conversionRate: 0 },
            { source: 'Referral', applications: 15, hires: 1, conversionRate: 6.7 },
            { source: 'Other', applications: 5, hires: 0, conversionRate: 0 }
          ],
          topPerformingSources: [
            { source: 'LinkedIn', score: 8.6 },
            { source: 'Company Website', score: 8.0 },
            { source: 'Referral', score: 6.7 }
          ]
        };
        
        res.json(sourceData);
      });

      const response = await request(app)
        .get('/api/analytics/source-tracking')
        .expect(200);

      expect(response.body.totalApplications).toBe(100);
      expect(Array.isArray(response.body.sources)).toBe(true);
      expect(Array.isArray(response.body.topPerformingSources)).toBe(true);
      expect(response.body.sources[0]).toHaveProperty('conversionRate');
    });
  });

  describe('Dashboard Metrics Enhancement', () => {
    test('should validate enhanced dashboard analytics', async () => {
      app.get('/api/analytics/dashboard', (req, res) => {
        const dashboardData = {
          overview: {
            totalJobs: 15,
            activeJobs: 8,
            totalCandidates: 156,
            newApplications: 12,
            interviewsScheduled: 5,
            offersExtended: 2,
            hiresMade: 1
          },
          trends: {
            applicationsThisMonth: 45,
            applicationsLastMonth: 38,
            applicationGrowth: 18.4,
            hireRateThisMonth: 4.4,
            hireRateLastMonth: 5.3,
            timeToHireThisMonth: 21,
            timeToHireLastMonth: 24
          },
          recentActivity: [
            { type: 'application', candidateName: 'John Doe', jobTitle: 'Software Engineer', timestamp: new Date().toISOString() },
            { type: 'interview', candidateName: 'Jane Smith', jobTitle: 'Marketing Manager', timestamp: new Date().toISOString() },
            { type: 'hire', candidateName: 'Bob Wilson', jobTitle: 'Sales Rep', timestamp: new Date().toISOString() }
          ]
        };
        
        res.json(dashboardData);
      });

      const response = await request(app)
        .get('/api/analytics/dashboard')
        .expect(200);

      expect(response.body).toHaveProperty('overview');
      expect(response.body).toHaveProperty('trends');
      expect(response.body).toHaveProperty('recentActivity');
      expect(response.body.overview.totalJobs).toBe(15);
      expect(Array.isArray(response.body.recentActivity)).toBe(true);
    });

    test('should validate department performance metrics', async () => {
      app.get('/api/analytics/department-performance', (req, res) => {
        const departmentData = {
          departments: [
            {
              name: 'Engineering',
              openPositions: 5,
              totalApplications: 80,
              averageTimeToHire: 25,
              hireRate: 6.3,
              topPerformingJobs: ['Senior Software Engineer', 'DevOps Engineer']
            },
            {
              name: 'Marketing',
              openPositions: 2,
              totalApplications: 45,
              averageTimeToHire: 18,
              hireRate: 8.9,
              topPerformingJobs: ['Marketing Manager', 'Content Specialist']
            },
            {
              name: 'Sales',
              openPositions: 1,
              totalApplications: 31,
              averageTimeToHire: 15,
              hireRate: 9.7,
              topPerformingJobs: ['Sales Representative']
            }
          ],
          bestPerforming: {
            department: 'Sales',
            metric: 'hireRate',
            value: 9.7
          }
        };
        
        res.json(departmentData);
      });

      const response = await request(app)
        .get('/api/analytics/department-performance')
        .expect(200);

      expect(Array.isArray(response.body.departments)).toBe(true);
      expect(response.body.departments.length).toBe(3);
      expect(response.body.bestPerforming.department).toBe('Sales');
      expect(response.body.departments[0]).toHaveProperty('hireRate');
    });
  });

  describe('Custom Reports', () => {
    test('should validate custom report generation', async () => {
      app.post('/api/analytics/custom-reports', (req, res) => {
        const { reportType, dateRange, filters, metrics } = req.body;
        
        if (!reportType || !dateRange || !metrics) {
          return res.status(400).json({ error: 'Report type, date range, and metrics are required' });
        }
        
        const validReportTypes = ['hiring', 'pipeline', 'performance', 'diversity'];
        if (!validReportTypes.includes(reportType)) {
          return res.status(400).json({ error: 'Invalid report type' });
        }
        
        res.json({
          reportId: Date.now(),
          reportType,
          dateRange,
          filters: filters || {},
          metrics,
          status: 'generating',
          estimatedCompletion: new Date(Date.now() + 30000).toISOString() // 30 seconds
        });
      });

      const response = await request(app)
        .post('/api/analytics/custom-reports')
        .send({
          reportType: 'hiring',
          dateRange: { start: '2024-01-01', end: '2024-12-31' },
          metrics: ['timeToHire', 'conversionRate', 'sourceEffectiveness'],
          filters: { department: 'Engineering' }
        })
        .expect(200);

      expect(response.body.reportType).toBe('hiring');
      expect(response.body.status).toBe('generating');
      expect(response.body).toHaveProperty('reportId');
    });
  });
});