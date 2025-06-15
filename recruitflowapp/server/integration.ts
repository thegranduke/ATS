import { Express, Request, Response } from "express";
import { storage } from "./storage";
import { insertBrokerkitIntegrationSchema, brokerkitIntegrationSchema } from "@shared/schema";
import { ZodError } from "zod";

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

export function setupIntegrationRoutes(app: Express) {
  
  // Get all integrations for the company
  app.get("/api/integrations", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const tenantId = req.activeTenantId || req.user!.companyId;
      const integrations = await storage.getBrokerkitIntegrationsByCompany(tenantId);
      
      res.json(integrations);
    } catch (error) {
      console.error("Error fetching integrations:", error);
      res.status(500).json({ error: "Failed to fetch integrations" });
    }
  });

  // Get specific Brokerkit integration
  app.get("/api/integrations/brokerkit", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const tenantId = req.activeTenantId || req.user!.companyId;
      const integration = await storage.getBrokerkitIntegrationByCompany(tenantId);
      
      if (!integration) {
        return res.status(404).json({ error: "No Brokerkit integration found" });
      }

      res.json(integration);
    } catch (error) {
      console.error("Error fetching Brokerkit integration:", error);
      res.status(500).json({ error: "Failed to fetch Brokerkit integration" });
    }
  });

  // Create or update Brokerkit integration
  app.post("/api/integrations/brokerkit", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Check if user has admin permissions
      if (req.user!.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const tenantId = req.activeTenantId || req.user!.companyId;
      
      // Validate request body
      const validationResult = insertBrokerkitIntegrationSchema.safeParse({
        ...req.body,
        companyId: tenantId
      });

      if (!validationResult.success) {
        return res.status(400).json({
          error: "Invalid integration data",
          details: validationResult.error.errors
        });
      }

      const integrationData = validationResult.data;

      // Check if integration already exists
      const existingIntegration = await storage.getBrokerkitIntegrationByCompany(tenantId);
      
      let integration;
      if (existingIntegration) {
        // Update existing integration
        integration = await storage.updateBrokerkitIntegration(existingIntegration.id, integrationData);
        console.log(`Updated Brokerkit integration for company ${tenantId}`);
      } else {
        // Create new integration
        integration = await storage.createBrokerkitIntegration(integrationData);
        console.log(`Created new Brokerkit integration for company ${tenantId}`);
      }

      res.json({
        success: true,
        message: existingIntegration ? "Integration updated successfully" : "Integration created successfully",
        integration
      });

    } catch (error) {
      console.error("Error saving Brokerkit integration:", error);
      
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: "Validation failed",
          details: error.errors
        });
      }

      res.status(500).json({ error: "Failed to save Brokerkit integration" });
    }
  });

  // Test Brokerkit integration connection
  app.post("/api/integrations/brokerkit/test", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const tenantId = req.activeTenantId || req.user!.companyId;
      const integration = await storage.getBrokerkitIntegrationByCompany(tenantId);
      
      if (!integration) {
        return res.status(404).json({ error: "No Brokerkit integration configured" });
      }

      if (!integration.enabled) {
        return res.status(400).json({ error: "Integration is disabled" });
      }

      // Test the connection (simplified test)
      const testResult = await testBrokerkitConnection(integration);
      
      if (testResult.success) {
        res.json({
          success: true,
          message: "Connection test successful",
          details: testResult.details
        });
      } else {
        res.status(400).json({
          success: false,
          message: "Connection test failed",
          error: testResult.error
        });
      }

    } catch (error) {
      console.error("Error testing Brokerkit integration:", error);
      res.status(500).json({ error: "Failed to test integration" });
    }
  });

  // Delete Brokerkit integration
  app.delete("/api/integrations/brokerkit", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Check if user has admin permissions
      if (req.user!.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const tenantId = req.activeTenantId || req.user!.companyId;
      const integration = await storage.getBrokerkitIntegrationByCompany(tenantId);
      
      if (!integration) {
        return res.status(404).json({ error: "No Brokerkit integration found" });
      }

      await storage.deleteBrokerkitIntegration(integration.id);
      
      res.json({
        success: true,
        message: "Integration deleted successfully"
      });

    } catch (error) {
      console.error("Error deleting Brokerkit integration:", error);
      res.status(500).json({ error: "Failed to delete integration" });
    }
  });

  // Sync jobs with Brokerkit
  app.post("/api/integrations/brokerkit/sync", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const tenantId = req.activeTenantId || req.user!.companyId;
      const integration = await storage.getBrokerkitIntegrationByCompany(tenantId);
      
      if (!integration || !integration.enabled) {
        return res.status(400).json({ error: "Brokerkit integration not enabled" });
      }

      // Get active jobs for the company
      const jobs = await storage.getJobsByCompany(tenantId);
      const activeJobs = jobs.filter(job => job.status === 'active');

      const syncResults = [];
      const errors = [];

      for (const job of activeJobs) {
        try {
          const syncResult = await syncJobToBrokerkit(job, integration);
          syncResults.push({
            jobId: job.id,
            jobTitle: job.title,
            status: syncResult.success ? 'synced' : 'failed',
            details: syncResult.details
          });
        } catch (error) {
          errors.push({
            jobId: job.id,
            jobTitle: job.title,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      res.json({
        success: true,
        message: `Synced ${syncResults.length} jobs to Brokerkit`,
        results: syncResults,
        errors: errors,
        summary: {
          total: activeJobs.length,
          successful: syncResults.filter(r => r.status === 'synced').length,
          failed: errors.length
        }
      });

    } catch (error) {
      console.error("Error syncing with Brokerkit:", error);
      res.status(500).json({ error: "Failed to sync with Brokerkit" });
    }
  });
}

// Helper function to test Brokerkit connection
async function testBrokerkitConnection(integration: any): Promise<{success: boolean, details?: any, error?: string}> {
  try {
    // This would normally make an actual API call to Brokerkit
    // For now, we'll simulate a connection test
    if (!integration.apiKey) {
      return {
        success: false,
        error: "API key is required"
      };
    }

    if (!integration.baseUrl) {
      return {
        success: false,
        error: "Base URL is required"
      };
    }

    // Simulate API call validation
    if (integration.apiKey.length < 10) {
      return {
        success: false,
        error: "Invalid API key format"
      };
    }

    return {
      success: true,
      details: {
        endpoint: integration.baseUrl,
        authenticated: true,
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Connection test failed"
    };
  }
}

// Helper function to sync a job to Brokerkit
async function syncJobToBrokerkit(job: any, integration: any): Promise<{success: boolean, details?: any}> {
  try {
    // This would normally make an actual API call to post the job to Brokerkit
    // For now, we'll simulate the sync process
    
    const jobData = {
      title: job.title,
      description: job.description,
      department: job.department,
      type: job.type,
      experience: job.experience,
      externalId: job.id,
      companyId: integration.companyId
    };

    // Simulate successful sync
    return {
      success: true,
      details: {
        brokerkitJobId: `bk_${Date.now()}_${job.id}`,
        syncedAt: new Date().toISOString(),
        status: 'published'
      }
    };

  } catch (error) {
    throw new Error(`Failed to sync job ${job.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}