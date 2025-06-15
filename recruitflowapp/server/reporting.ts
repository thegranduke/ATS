import { Express, Request, Response } from "express";
import { storage } from "./storage";
import { z } from "zod";

declare module "express-serve-static-core" {
  interface Request {
    isAuthenticated(): boolean;
    user?: {
      id: number;
      companyId: number;
      role: string;
    };
    activeTenantId?: number;
  }
}

// Date range validation schema
const dateRangeSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  period: z.enum(['7d', '30d', '90d', '1y', 'custom']).optional()
});

export function setupReportingRoutes(app: Express) {
  
  // Comprehensive hiring metrics dashboard
  app.get("/api/reports/hiring-metrics", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const tenantId = req.activeTenantId || req.user!.companyId;
      const { startDate, endDate, period = '30d' } = req.query;

      // Calculate date range
      const dateRange = calculateDateRange(period as string, startDate as string, endDate as string);
      
      // Get all jobs and candidates for the period
      const jobs = await storage.getJobsByCompany(tenantId);
      const candidates = await storage.getCandidatesByCompany(tenantId);
      
      // Filter by date range
      const filteredJobs = jobs.filter(job => 
        new Date(job.createdAt) >= dateRange.start && new Date(job.createdAt) <= dateRange.end
      );
      
      const filteredCandidates = candidates.filter(candidate => 
        new Date(candidate.createdAt) >= dateRange.start && new Date(candidate.createdAt) <= dateRange.end
      );

      // Calculate metrics
      const metrics = {
        overview: {
          totalJobs: filteredJobs.length,
          activeJobs: filteredJobs.filter(j => j.status === 'active').length,
          totalCandidates: filteredCandidates.length,
          hiredCandidates: filteredCandidates.filter(c => c.status === 'hired').length,
          averageTimeToHire: calculateAverageTimeToHire(filteredCandidates),
          conversionRate: calculateConversionRate(filteredCandidates)
        },
        
        trends: {
          jobsCreated: generateTimeSeries(filteredJobs, 'createdAt', dateRange),
          candidatesApplied: generateTimeSeries(filteredCandidates, 'createdAt', dateRange),
          hiringProgress: generateHiringTimeSeries(filteredCandidates, dateRange)
        },
        
        statusBreakdown: {
          jobs: generateStatusBreakdown(filteredJobs, 'status'),
          candidates: generateStatusBreakdown(filteredCandidates, 'status')
        },
        
        departmentAnalytics: generateDepartmentAnalytics(filteredJobs, filteredCandidates),
        
        topPerformingJobs: getTopPerformingJobs(filteredJobs, filteredCandidates),
        
        bottleneckAnalysis: analyzeHiringBottlenecks(filteredCandidates)
      };

      res.json({
        metrics,
        dateRange: {
          start: dateRange.start,
          end: dateRange.end,
          period
        },
        generatedAt: new Date().toISOString()
      });

    } catch (error) {
      console.error("Error generating hiring metrics:", error);
      res.status(500).json({ error: "Failed to generate hiring metrics" });
    }
  });

  // Candidate pipeline analytics
  app.get("/api/reports/pipeline-analytics", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const tenantId = req.activeTenantId || req.user!.companyId;
      const { jobId, startDate, endDate } = req.query;

      let candidates = await storage.getCandidatesByCompany(tenantId);
      
      // Filter by job if specified
      if (jobId) {
        candidates = candidates.filter(c => c.jobId === parseInt(jobId as string));
      }

      // Filter by date range if specified
      if (startDate && endDate) {
        const start = new Date(startDate as string);
        const end = new Date(endDate as string);
        candidates = candidates.filter(c => 
          new Date(c.createdAt) >= start && new Date(c.createdAt) <= end
        );
      }

      // Pipeline stage analysis
      const pipelineStages = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected'];
      const stageMetrics = pipelineStages.map(stage => {
        const stageCount = candidates.filter(c => c.status === stage).length;
        return {
          stage,
          count: stageCount,
          percentage: candidates.length > 0 ? Math.round((stageCount / candidates.length) * 100) : 0
        };
      });

      // Conversion rates between stages
      const conversionRates = calculateStageConversions(candidates);
      
      // Time spent in each stage
      const stageTimings = calculateStageTimings(candidates);
      
      // Drop-off analysis
      const dropOffAnalysis = analyzeDropOffs(candidates);

      res.json({
        pipeline: {
          totalCandidates: candidates.length,
          stageMetrics,
          conversionRates,
          stageTimings,
          dropOffAnalysis
        },
        filters: {
          jobId: jobId || null,
          dateRange: startDate && endDate ? { startDate, endDate } : null
        }
      });

    } catch (error) {
      console.error("Error generating pipeline analytics:", error);
      res.status(500).json({ error: "Failed to generate pipeline analytics" });
    }
  });

  // Source performance analytics
  app.get("/api/reports/source-performance", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const tenantId = req.activeTenantId || req.user!.companyId;
      const { period = '30d' } = req.query;

      const dateRange = calculateDateRange(period as string);
      
      // Get application form analytics
      const analytics = await storage.getApplicationFormAnalyticsByCompany(tenantId);
      
      // Filter by date range
      const filteredAnalytics = analytics.filter(a => 
        new Date(a.startTime) >= dateRange.start && new Date(a.startTime) <= dateRange.end
      );

      // Group by source
      const sourcePerformance = new Map();
      
      filteredAnalytics.forEach(record => {
        const source = record.source || 'direct';
        if (!sourcePerformance.has(source)) {
          sourcePerformance.set(source, {
            source,
            totalApplications: 0,
            completedApplications: 0,
            conversions: 0,
            averageTime: 0,
            devices: new Map(),
            browsers: new Map()
          });
        }
        
        const perf = sourcePerformance.get(source);
        perf.totalApplications++;
        
        if (record.formCompleted) {
          perf.completedApplications++;
        }
        
        if (record.submitted) {
          perf.conversions++;
        }
        
        // Track device types
        const device = record.deviceType || 'unknown';
        perf.devices.set(device, (perf.devices.get(device) || 0) + 1);
        
        // Track browsers
        const browser = record.browserName || 'unknown';
        perf.browsers.set(browser, (perf.browsers.get(browser) || 0) + 1);
      });

      // Convert to array and calculate rates
      const sourceResults = Array.from(sourcePerformance.values()).map(perf => ({
        source: perf.source,
        totalApplications: perf.totalApplications,
        completedApplications: perf.completedApplications,
        conversions: perf.conversions,
        completionRate: perf.totalApplications > 0 ? 
          Math.round((perf.completedApplications / perf.totalApplications) * 100) : 0,
        conversionRate: perf.totalApplications > 0 ? 
          Math.round((perf.conversions / perf.totalApplications) * 100) : 0,
        topDevices: Array.from(perf.devices.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([device, count]) => ({ device, count })),
        topBrowsers: Array.from(perf.browsers.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([browser, count]) => ({ browser, count }))
      })).sort((a, b) => b.totalApplications - a.totalApplications);

      res.json({
        sources: sourceResults,
        summary: {
          totalSources: sourceResults.length,
          bestPerformingSource: sourceResults[0]?.source || null,
          totalApplications: sourceResults.reduce((sum, s) => sum + s.totalApplications, 0),
          overallConversionRate: Math.round(
            sourceResults.reduce((sum, s) => sum + s.conversions, 0) / 
            Math.max(sourceResults.reduce((sum, s) => sum + s.totalApplications, 0), 1) * 100
          )
        },
        period
      });

    } catch (error) {
      console.error("Error generating source performance report:", error);
      res.status(500).json({ error: "Failed to generate source performance report" });
    }
  });

  // Time-to-hire analytics
  app.get("/api/reports/time-to-hire", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const tenantId = req.activeTenantId || req.user!.companyId;
      const { department, jobType, period = '90d' } = req.query;

      const dateRange = calculateDateRange(period as string);
      const candidates = await storage.getCandidatesByCompany(tenantId);
      const jobs = await storage.getJobsByCompany(tenantId);

      // Filter hired candidates in date range
      let hiredCandidates = candidates.filter(c => 
        c.status === 'hired' && 
        new Date(c.createdAt) >= dateRange.start && 
        new Date(c.createdAt) <= dateRange.end
      );

      // Filter by department if specified
      if (department) {
        const jobsByDept = jobs.filter(j => j.department === department);
        const jobIdsByDept = new Set(jobsByDept.map(j => j.id));
        hiredCandidates = hiredCandidates.filter(c => c.jobId && jobIdsByDept.has(c.jobId));
      }

      // Filter by job type if specified
      if (jobType) {
        const jobsByType = jobs.filter(j => j.type === jobType);
        const jobIdsByType = new Set(jobsByType.map(j => j.id));
        hiredCandidates = hiredCandidates.filter(c => c.jobId && jobIdsByType.has(c.jobId));
      }

      // Calculate time-to-hire metrics
      const timeToHireData = hiredCandidates.map(candidate => {
        const job = jobs.find(j => j.id === candidate.jobId);
        const applicationDate = new Date(candidate.createdAt);
        const hireDate = new Date(); // In real implementation, this would be the actual hire date
        const daysToHire = Math.floor((hireDate.getTime() - applicationDate.getTime()) / (1000 * 60 * 60 * 24));
        
        return {
          candidateId: candidate.id,
          candidateName: candidate.fullName,
          jobTitle: job?.title || 'Unknown',
          department: job?.department || 'Unknown',
          jobType: job?.type || 'Unknown',
          applicationDate,
          hireDate,
          daysToHire
        };
      });

      // Calculate statistics
      const daysToHireValues = timeToHireData.map(d => d.daysToHire);
      const averageTimeToHire = daysToHireValues.length > 0 ? 
        Math.round(daysToHireValues.reduce((sum, days) => sum + days, 0) / daysToHireValues.length) : 0;
      
      const medianTimeToHire = calculateMedian(daysToHireValues);
      const percentiles = {
        p25: calculatePercentile(daysToHireValues, 25),
        p50: medianTimeToHire,
        p75: calculatePercentile(daysToHireValues, 75),
        p90: calculatePercentile(daysToHireValues, 90)
      };

      // Group by department
      const departmentBreakdown = groupByDepartment(timeToHireData);
      
      // Identify trends over time
      const timelineTrends = generateTimeToHireTrends(timeToHireData, dateRange);

      res.json({
        summary: {
          totalHires: hiredCandidates.length,
          averageTimeToHire,
          medianTimeToHire,
          percentiles,
          fastestHire: Math.min(...daysToHireValues) || 0,
          slowestHire: Math.max(...daysToHireValues) || 0
        },
        departmentBreakdown,
        timelineTrends,
        individualHires: timeToHireData,
        filters: {
          department: department || null,
          jobType: jobType || null,
          period
        }
      });

    } catch (error) {
      console.error("Error generating time-to-hire report:", error);
      res.status(500).json({ error: "Failed to generate time-to-hire report" });
    }
  });

  // Custom report builder
  app.post("/api/reports/custom", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const tenantId = req.activeTenantId || req.user!.companyId;
      const { 
        metrics,
        filters,
        groupBy,
        dateRange,
        name 
      } = req.body;

      // Validate required fields
      if (!metrics || !Array.isArray(metrics) || metrics.length === 0) {
        return res.status(400).json({ error: "Metrics are required" });
      }

      // Get base data
      const jobs = await storage.getJobsByCompany(tenantId);
      const candidates = await storage.getCandidatesByCompany(tenantId);

      // Apply filters
      let filteredJobs = applyFilters(jobs, filters);
      let filteredCandidates = applyFilters(candidates, filters);

      // Apply date range
      if (dateRange) {
        const start = new Date(dateRange.startDate);
        const end = new Date(dateRange.endDate);
        
        filteredJobs = filteredJobs.filter(j => 
          new Date(j.createdAt) >= start && new Date(j.createdAt) <= end
        );
        
        filteredCandidates = filteredCandidates.filter(c => 
          new Date(c.createdAt) >= start && new Date(c.createdAt) <= end
        );
      }

      // Calculate requested metrics
      const reportData = {};
      
      for (const metric of metrics) {
        switch (metric) {
          case 'job_count':
            reportData['jobCount'] = filteredJobs.length;
            break;
          case 'candidate_count':
            reportData['candidateCount'] = filteredCandidates.length;
            break;
          case 'hire_count':
            reportData['hireCount'] = filteredCandidates.filter(c => c.status === 'hired').length;
            break;
          case 'conversion_rate':
            reportData['conversionRate'] = calculateConversionRate(filteredCandidates);
            break;
          case 'time_to_hire':
            reportData['averageTimeToHire'] = calculateAverageTimeToHire(filteredCandidates);
            break;
          case 'applications_per_job':
            reportData['applicationsPerJob'] = filteredJobs.length > 0 ? 
              Math.round(filteredCandidates.length / filteredJobs.length) : 0;
            break;
        }
      }

      // Apply grouping if specified
      let groupedData = null;
      if (groupBy) {
        groupedData = applyGrouping(filteredJobs, filteredCandidates, groupBy, metrics);
      }

      const report = {
        name: name || `Custom Report - ${new Date().toLocaleDateString()}`,
        data: reportData,
        groupedData,
        filters,
        dateRange,
        generatedAt: new Date().toISOString(),
        recordCount: {
          jobs: filteredJobs.length,
          candidates: filteredCandidates.length
        }
      };

      res.json(report);

    } catch (error) {
      console.error("Error generating custom report:", error);
      res.status(500).json({ error: "Failed to generate custom report" });
    }
  });
}

// Helper functions for calculations
function calculateDateRange(period: string, startDate?: string, endDate?: string) {
  const end = endDate ? new Date(endDate) : new Date();
  let start: Date;

  if (startDate) {
    start = new Date(startDate);
  } else {
    switch (period) {
      case '7d':
        start = new Date(end.getTime() - (7 * 24 * 60 * 60 * 1000));
        break;
      case '30d':
        start = new Date(end.getTime() - (30 * 24 * 60 * 60 * 1000));
        break;
      case '90d':
        start = new Date(end.getTime() - (90 * 24 * 60 * 60 * 1000));
        break;
      case '1y':
        start = new Date(end.getTime() - (365 * 24 * 60 * 60 * 1000));
        break;
      default:
        start = new Date(end.getTime() - (30 * 24 * 60 * 60 * 1000));
    }
  }

  return { start, end };
}

function calculateAverageTimeToHire(candidates: any[]): number {
  const hired = candidates.filter(c => c.status === 'hired');
  if (hired.length === 0) return 0;
  
  // Simplified calculation - in real implementation, this would use actual hire dates
  const avgDays = hired.reduce((sum, candidate) => {
    const days = Math.floor((Date.now() - new Date(candidate.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    return sum + Math.min(days, 60); // Cap at 60 days for demo
  }, 0) / hired.length;
  
  return Math.round(avgDays);
}

function calculateConversionRate(candidates: any[]): number {
  if (candidates.length === 0) return 0;
  const hired = candidates.filter(c => c.status === 'hired').length;
  return Math.round((hired / candidates.length) * 100);
}

function generateTimeSeries(data: any[], dateField: string, dateRange: any) {
  const series = [];
  const dayMs = 24 * 60 * 60 * 1000;
  
  for (let d = new Date(dateRange.start); d <= dateRange.end; d = new Date(d.getTime() + dayMs)) {
    const dayStr = d.toISOString().split('T')[0];
    const count = data.filter(item => 
      new Date(item[dateField]).toISOString().split('T')[0] === dayStr
    ).length;
    
    series.push({ date: dayStr, count });
  }
  
  return series;
}

function generateStatusBreakdown(data: any[], statusField: string) {
  const breakdown = new Map();
  
  data.forEach(item => {
    const status = item[statusField];
    breakdown.set(status, (breakdown.get(status) || 0) + 1);
  });
  
  return Array.from(breakdown.entries()).map(([status, count]) => ({
    status,
    count,
    percentage: Math.round((count / data.length) * 100)
  }));
}

function generateHiringTimeSeries(candidates: any[], dateRange: any) {
  return generateTimeSeries(
    candidates.filter(c => c.status === 'hired'),
    'createdAt',
    dateRange
  );
}

function generateDepartmentAnalytics(jobs: any[], candidates: any[]) {
  const deptMap = new Map();
  
  jobs.forEach(job => {
    if (!deptMap.has(job.department)) {
      deptMap.set(job.department, { jobs: 0, candidates: 0, hired: 0 });
    }
    deptMap.get(job.department).jobs++;
  });
  
  candidates.forEach(candidate => {
    const job = jobs.find(j => j.id === candidate.jobId);
    if (job) {
      const dept = deptMap.get(job.department);
      if (dept) {
        dept.candidates++;
        if (candidate.status === 'hired') dept.hired++;
      }
    }
  });
  
  return Array.from(deptMap.entries()).map(([department, stats]) => ({
    department,
    ...stats,
    conversionRate: stats.candidates > 0 ? Math.round((stats.hired / stats.candidates) * 100) : 0
  }));
}

function getTopPerformingJobs(jobs: any[], candidates: any[]) {
  return jobs.map(job => {
    const jobCandidates = candidates.filter(c => c.jobId === job.id);
    const hired = jobCandidates.filter(c => c.status === 'hired').length;
    
    return {
      id: job.id,
      title: job.title,
      department: job.department,
      applicants: jobCandidates.length,
      hired,
      conversionRate: jobCandidates.length > 0 ? Math.round((hired / jobCandidates.length) * 100) : 0
    };
  }).sort((a, b) => b.conversionRate - a.conversionRate).slice(0, 5);
}

function analyzeHiringBottlenecks(candidates: any[]) {
  const stages = ['applied', 'screening', 'interview', 'offer', 'hired'];
  const stageCounts = new Map();
  
  stages.forEach(stage => {
    stageCounts.set(stage, candidates.filter(c => c.status === stage).length);
  });
  
  return Array.from(stageCounts.entries()).map(([stage, count]) => ({
    stage,
    count,
    percentage: Math.round((count / candidates.length) * 100)
  }));
}

function calculateStageConversions(candidates: any[]) {
  const stageOrder = ['applied', 'screening', 'interview', 'offer', 'hired'];
  const conversions = [];
  
  for (let i = 0; i < stageOrder.length - 1; i++) {
    const currentStage = stageOrder[i];
    const nextStage = stageOrder[i + 1];
    
    const currentCount = candidates.filter(c => 
      stageOrder.indexOf(c.status) >= i
    ).length;
    
    const nextCount = candidates.filter(c => 
      stageOrder.indexOf(c.status) >= i + 1
    ).length;
    
    conversions.push({
      from: currentStage,
      to: nextStage,
      rate: currentCount > 0 ? Math.round((nextCount / currentCount) * 100) : 0
    });
  }
  
  return conversions;
}

function calculateStageTimings(candidates: any[]) {
  // Simplified - in real implementation, this would track actual stage transition dates
  return [
    { stage: 'screening', averageDays: 3 },
    { stage: 'interview', averageDays: 7 },
    { stage: 'offer', averageDays: 2 },
    { stage: 'hired', averageDays: 5 }
  ];
}

function analyzeDropOffs(candidates: any[]) {
  const stages = ['applied', 'screening', 'interview', 'offer'];
  return stages.map(stage => {
    const stageCount = candidates.filter(c => c.status === stage).length;
    return {
      stage,
      dropOffs: stageCount,
      percentage: Math.round((stageCount / candidates.length) * 100)
    };
  });
}

function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function groupByDepartment(timeToHireData: any[]) {
  const grouped = new Map();
  
  timeToHireData.forEach(hire => {
    if (!grouped.has(hire.department)) {
      grouped.set(hire.department, []);
    }
    grouped.get(hire.department).push(hire.daysToHire);
  });
  
  return Array.from(grouped.entries()).map(([department, days]) => ({
    department,
    averageDays: Math.round(days.reduce((sum: number, d: number) => sum + d, 0) / days.length),
    hireCount: days.length
  }));
}

function generateTimeToHireTrends(timeToHireData: any[], dateRange: any) {
  // Simplified trend calculation
  const monthlyData = new Map();
  
  timeToHireData.forEach(hire => {
    const month = hire.applicationDate.toISOString().substring(0, 7); // YYYY-MM
    if (!monthlyData.has(month)) {
      monthlyData.set(month, []);
    }
    monthlyData.get(month).push(hire.daysToHire);
  });
  
  return Array.from(monthlyData.entries()).map(([month, days]) => ({
    month,
    averageDays: Math.round(days.reduce((sum: number, d: number) => sum + d, 0) / days.length),
    hireCount: days.length
  })).sort((a, b) => a.month.localeCompare(b.month));
}

function applyFilters(data: any[], filters: any) {
  if (!filters) return data;
  
  return data.filter(item => {
    for (const [key, value] of Object.entries(filters)) {
      if (value && item[key] !== value) {
        return false;
      }
    }
    return true;
  });
}

function applyGrouping(jobs: any[], candidates: any[], groupBy: string, metrics: string[]) {
  const grouped = new Map();
  
  const allData = [...jobs.map(j => ({ ...j, type: 'job' })), ...candidates.map(c => ({ ...c, type: 'candidate' }))];
  
  allData.forEach(item => {
    const groupKey = item[groupBy] || 'Unknown';
    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, { jobs: [], candidates: [] });
    }
    
    if (item.type === 'job') {
      grouped.get(groupKey).jobs.push(item);
    } else {
      grouped.get(groupKey).candidates.push(item);
    }
  });
  
  return Array.from(grouped.entries()).map(([group, data]) => ({
    group,
    jobCount: data.jobs.length,
    candidateCount: data.candidates.length,
    hireCount: data.candidates.filter((c: any) => c.status === 'hired').length
  }));
}