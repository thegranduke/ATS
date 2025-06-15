import { Express, Request, Response } from "express";
import { storage } from "./storage";
import { insertApplicationFormAnalyticsSchema } from "@shared/schema";
import { ZodError } from "zod";

declare module "express-serve-static-core" {
  interface Request {
    isAuthenticated(): boolean;
    user?: {
      id: number;
      companyId: number;
    };
    activeTenantId?: number;
  }
}

export function setupAnalyticsRoutes(app: Express) {
  
  // Get application form analytics for a specific job
  app.get("/api/analytics/job/:jobId/forms", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const jobId = parseInt(req.params.jobId);
      const tenantId = req.activeTenantId || req.user!.companyId;
      
      // Verify job belongs to the company
      const job = await storage.getJobById(jobId);
      if (!job || job.companyId !== tenantId) {
        return res.status(404).json({ error: "Job not found" });
      }

      const analytics = await storage.getApplicationFormAnalyticsByJob(jobId);
      
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching job form analytics:", error);
      res.status(500).json({ error: "Failed to fetch form analytics" });
    }
  });

  // Get comprehensive conversion analytics for the company
  app.get("/api/analytics/conversions", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const tenantId = req.activeTenantId || req.user!.companyId;
      const { startDate, endDate } = req.query;
      
      let dateRange;
      if (startDate && endDate) {
        dateRange = {
          startDate: new Date(startDate as string),
          endDate: new Date(endDate as string)
        };
      }

      const conversionData = await storage.getConversionRatesByCompany(tenantId, dateRange);
      
      res.json(conversionData);
    } catch (error) {
      console.error("Error fetching conversion analytics:", error);
      res.status(500).json({ error: "Failed to fetch conversion analytics" });
    }
  });

  // Track application form start
  app.post("/api/analytics/forms/start", async (req: Request, res: Response) => {
    try {
      const { jobId, sessionId, source, userAgent, ipAddress, referrer } = req.body;
      
      if (!jobId || !sessionId) {
        return res.status(400).json({ error: "Job ID and session ID are required" });
      }

      // Get job to determine company
      const job = await storage.getJobById(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      const analyticsData = {
        companyId: job.companyId,
        jobId,
        sessionId,
        formStarted: true,
        startTime: new Date(),
        source: source || 'direct',
        userAgent: userAgent || null,
        ipAddress: ipAddress || null,
        referrer: referrer || null,
        deviceType: detectDeviceType(userAgent),
        browserName: detectBrowser(userAgent)
      };

      const analytics = await storage.createApplicationFormAnalytics(analyticsData);
      
      res.json({
        success: true,
        sessionId: analytics.sessionId,
        trackingId: analytics.id
      });

    } catch (error) {
      console.error("Error tracking form start:", error);
      res.status(500).json({ error: "Failed to track form start" });
    }
  });

  // Track application form completion
  app.post("/api/analytics/forms/complete", async (req: Request, res: Response) => {
    try {
      const { sessionId, completionTime, fieldsCompleted } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: "Session ID is required" });
      }

      const updates = {
        formCompleted: true,
        completionTime: completionTime ? new Date(completionTime) : new Date(),
        fieldsCompleted: fieldsCompleted || null
      };

      const analytics = await storage.updateApplicationFormAnalytics(sessionId, updates);
      
      res.json({
        success: true,
        analytics
      });

    } catch (error) {
      console.error("Error tracking form completion:", error);
      res.status(500).json({ error: "Failed to track form completion" });
    }
  });

  // Track successful application submission
  app.post("/api/analytics/forms/submit", async (req: Request, res: Response) => {
    try {
      const { sessionId, candidateId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: "Session ID is required" });
      }

      const updates = {
        submitted: true,
        submissionTime: new Date(),
        candidateId: candidateId || null
      };

      const analytics = await storage.updateApplicationFormAnalytics(sessionId, updates);
      
      res.json({
        success: true,
        analytics
      });

    } catch (error) {
      console.error("Error tracking form submission:", error);
      res.status(500).json({ error: "Failed to track form submission" });
    }
  });

  // Get application source performance analytics
  app.get("/api/analytics/sources", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const tenantId = req.activeTenantId || req.user!.companyId;
      const { startDate, endDate } = req.query;
      
      let dateRange;
      if (startDate && endDate) {
        dateRange = {
          startDate: new Date(startDate as string),
          endDate: new Date(endDate as string)
        };
      }

      const analytics = await storage.getApplicationFormAnalyticsByCompany(tenantId);
      
      // Filter by date range if provided
      const filteredAnalytics = dateRange 
        ? analytics.filter(a => {
            const createdAt = new Date(a.startTime);
            return createdAt >= dateRange!.startDate && createdAt <= dateRange!.endDate;
          })
        : analytics;

      // Aggregate source performance
      const sourcePerformance = aggregateSourcePerformance(filteredAnalytics);
      
      res.json(sourcePerformance);
      
    } catch (error) {
      console.error("Error fetching source analytics:", error);
      res.status(500).json({ error: "Failed to fetch source analytics" });
    }
  });

  // Get device and browser analytics
  app.get("/api/analytics/devices", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const tenantId = req.activeTenantId || req.user!.companyId;
      const analytics = await storage.getApplicationFormAnalyticsByCompany(tenantId);
      
      // Aggregate device and browser data
      const deviceBreakdown = aggregateDeviceData(analytics);
      const browserBreakdown = aggregateBrowserData(analytics);
      
      res.json({
        devices: deviceBreakdown,
        browsers: browserBreakdown
      });
      
    } catch (error) {
      console.error("Error fetching device analytics:", error);
      res.status(500).json({ error: "Failed to fetch device analytics" });
    }
  });
}

// Helper functions
function detectDeviceType(userAgent: string | null): string {
  if (!userAgent) return 'unknown';
  
  const ua = userAgent.toLowerCase();
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    return 'mobile';
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    return 'tablet';
  } else {
    return 'desktop';
  }
}

function detectBrowser(userAgent: string | null): string {
  if (!userAgent) return 'unknown';
  
  const ua = userAgent.toLowerCase();
  if (ua.includes('chrome')) return 'chrome';
  if (ua.includes('firefox')) return 'firefox';
  if (ua.includes('safari')) return 'safari';
  if (ua.includes('edge')) return 'edge';
  if (ua.includes('opera')) return 'opera';
  return 'other';
}

function aggregateSourcePerformance(analytics: any[]) {
  const sourceStats = new Map();
  
  analytics.forEach(record => {
    const source = record.source || 'direct';
    if (!sourceStats.has(source)) {
      sourceStats.set(source, {
        source,
        totalStarted: 0,
        totalCompleted: 0,
        totalSubmitted: 0,
        conversionRate: 0,
        completionRate: 0
      });
    }
    
    const stats = sourceStats.get(source);
    stats.totalStarted++;
    
    if (record.formCompleted) {
      stats.totalCompleted++;
    }
    
    if (record.submitted) {
      stats.totalSubmitted++;
    }
  });
  
  // Calculate rates
  sourceStats.forEach(stats => {
    stats.completionRate = stats.totalStarted > 0 
      ? Math.round((stats.totalCompleted / stats.totalStarted) * 100) 
      : 0;
    stats.conversionRate = stats.totalStarted > 0 
      ? Math.round((stats.totalSubmitted / stats.totalStarted) * 100) 
      : 0;
  });
  
  return Array.from(sourceStats.values()).sort((a, b) => b.totalStarted - a.totalStarted);
}

function aggregateDeviceData(analytics: any[]) {
  const deviceStats = new Map();
  
  analytics.forEach(record => {
    const device = record.deviceType || 'unknown';
    deviceStats.set(device, (deviceStats.get(device) || 0) + 1);
  });
  
  const total = analytics.length;
  return Array.from(deviceStats.entries()).map(([device, count]) => ({
    device,
    count,
    percentage: total > 0 ? Math.round((count / total) * 100) : 0
  }));
}

function aggregateBrowserData(analytics: any[]) {
  const browserStats = new Map();
  
  analytics.forEach(record => {
    const browser = record.browserName || 'unknown';
    browserStats.set(browser, (browserStats.get(browser) || 0) + 1);
  });
  
  const total = analytics.length;
  return Array.from(browserStats.entries()).map(([browser, count]) => ({
    browser,
    count,
    percentage: total > 0 ? Math.round((count / total) * 100) : 0
  }));
}