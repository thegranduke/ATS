import { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";

// Extending Express.Request and Session to include activeTenantId
declare global {
  namespace Express {
    interface Request {
      activeTenantId?: number;
    }
  }
}

// Add activeTenantId to session data
declare module 'express-session' {
  interface SessionData {
    activeTenantId?: number;
  }
}

// Add multi-tenant middlewares and routes
export function setupTenantManagement(app: Express) {
  // Middleware to add activeTenantId to each request
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated()) {
      // Check if user has explicitly set a tenant in session
      if (req.session.activeTenantId) {
        // Validate that user has access to this tenant
        const hasTenantAccess = await userHasAccessToTenant(req.user!.id, req.session.activeTenantId);
        if (hasTenantAccess) {
          req.activeTenantId = req.session.activeTenantId;
        } else {
          // If no longer has access, reset to default tenant
          req.session.activeTenantId = req.user!.companyId;
          req.activeTenantId = req.user!.companyId;
        }
      } else {
        // Default to user's primary company
        req.activeTenantId = req.user!.companyId;
        req.session.activeTenantId = req.user!.companyId;
      }
    }
    next();
  });

  // API endpoint to get available tenants for the current user
  app.get("/api/tenants", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const tenants = await getAvailableTenantsForUser(req.user!.id);
      return res.json(tenants);
    } catch (error) {
      console.error("Error fetching available tenants:", error);
      return res.status(500).json({ error: "Failed to fetch available tenants" });
    }
  });

  // API endpoint to switch tenant
  app.post("/api/tenants/switch", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { tenantId } = req.body;
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID is required" });
    }

    try {
      // Check if user has access to requested tenant
      const hasTenantAccess = await userHasAccessToTenant(req.user!.id, tenantId);
      if (!hasTenantAccess) {
        return res.status(403).json({ error: "Access denied to this tenant" });
      }

      // Update session with new active tenant
      req.session.activeTenantId = tenantId;
      req.activeTenantId = tenantId;

      // Get tenant details
      const tenant = await storage.getCompanyById(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      return res.json(tenant);
    } catch (error) {
      console.error("Error switching tenant:", error);
      return res.status(500).json({ error: "Failed to switch tenant" });
    }
  });

  // API endpoint to get current active tenant
  app.get("/api/tenants/active", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!req.activeTenantId) {
      return res.status(404).json({ error: "No active tenant" });
    }

    try {
      const tenant = await storage.getCompanyById(req.activeTenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      return res.json(tenant);
    } catch (error) {
      console.error("Error fetching active tenant:", error);
      return res.status(500).json({ error: "Failed to fetch active tenant" });
    }
  });
}

// Helper function to check if a user has access to a tenant
async function userHasAccessToTenant(userId: number, tenantId: number): Promise<boolean> {
  try {
    // Get user details
    const user = await storage.getUser(userId);
    if (!user) {
      return false;
    }

    // Check if this is user's primary company
    if (user.companyId === tenantId) {
      return true;
    }

    // TODO: Implement additional tenant access checks
    // For example, checking a user_tenants table for additional tenant access

    return false;
  } catch (error) {
    console.error("Error checking tenant access:", error);
    return false;
  }
}

// Helper function to get all available tenants for a user
async function getAvailableTenantsForUser(userId: number): Promise<any[]> {
  try {
    // Get user details
    const user = await storage.getUser(userId);
    if (!user) {
      return [];
    }

    // Get user's primary company
    const primaryCompany = await storage.getCompanyById(user.companyId);
    if (!primaryCompany) {
      return [];
    }

    // Start with primary company
    const tenants = [primaryCompany];

    // TODO: Get additional companies the user has access to
    // For example, query a user_tenants table for additional access

    return tenants;
  } catch (error) {
    console.error("Error getting available tenants:", error);
    return [];
  }
}

// Middleware to enforce tenant security on data access
export function tenantSecurityMiddleware(req: Request, res: Response, next: NextFunction) {
  // If not authenticated, pass to next middleware (which should handle auth)
  if (!req.isAuthenticated()) {
    return next();
  }

  // If no active tenant, use user's primary company
  if (!req.activeTenantId) {
    req.activeTenantId = req.user!.companyId;
  }

  next();
}