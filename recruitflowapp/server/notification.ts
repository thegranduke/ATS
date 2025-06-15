import { Express, Request, Response } from "express";
import { storage } from "./storage";
import { tenantSecurityMiddleware } from "./tenant";

declare module "express-serve-static-core" {
  interface Request {
    isAuthenticated(): boolean;
    user?: {
      id: number;
      companyId: number;
    };
  }
}

export function setupNotificationRoutes(app: Express) {
  // Get all notifications for the authenticated user
  app.get("/api/notifications", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const userId = req.user!.id;
      const notifications = await storage.getNotificationsByUser(userId);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  // Get unread notifications for the authenticated user
  app.get("/api/notifications/unread", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const userId = req.user!.id;
      const notifications = await storage.getUnreadNotificationsByUser(userId);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching unread notifications:", error);
      res.status(500).json({ error: "Failed to fetch unread notifications" });
    }
  });

  // Mark a specific notification as read
  app.post("/api/notifications/:id/mark-read", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const notificationId = parseInt(req.params.id);
      await storage.markNotificationAsRead(notificationId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  // Mark all notifications as read for the authenticated user
  app.post("/api/notifications/mark-all-read", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const userId = req.user!.id;
      await storage.markAllNotificationsAsRead(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ error: "Failed to mark all notifications as read" });
    }
  });
}

// Helper function to create notifications when candidates apply
export async function createCandidateApplicationNotification(candidateId: number, jobId: number, companyId: number) {
  try {
    // Get candidate and job details
    const candidate = await storage.getCandidateById(candidateId);
    const job = await storage.getJobById(jobId);
    
    if (!candidate || !job) {
      console.error("Could not find candidate or job for notification");
      return;
    }

    // Get all users in the company to notify them
    const companyUsers = await storage.getUsersByCompany(companyId);
    
    // Create notifications for all company users
    for (const user of companyUsers) {
      await storage.createNotification({
        userId: user.id,
        type: "new_candidate",
        title: "New Application Received",
        message: `${candidate.fullName} has applied for the ${job.title} position`,
        relatedId: candidateId,
        relatedType: "candidate"
      });
    }
    
    console.log(`Created notifications for ${companyUsers.length} users about new application from ${candidate.fullName}`);
  } catch (error) {
    console.error("Error creating candidate application notification:", error);
  }
}