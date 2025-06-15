import { Express, Request, Response } from "express";
import { storage } from "./storage";
import { insertSupportTicketSchema } from "@shared/schema";
import { ZodError } from "zod";

declare module "express-serve-static-core" {
  interface Request {
    isAuthenticated(): boolean;
    user?: {
      id: number;
      companyId: number;
    };
  }
}

export function setupSupportRoutes(app: Express) {
  // Get support tickets for the authenticated user
  app.get("/api/support/tickets", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const userId = req.user!.id;
      const tickets = await storage.getSupportTicketsByUser(userId);
      res.json(tickets);
    } catch (error) {
      console.error("Error fetching support tickets:", error);
      res.status(500).json({ error: "Failed to fetch support tickets" });
    }
  });

  // Create a new support ticket
  app.post("/api/support/tickets", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const userId = req.user!.id;
      const companyId = req.user!.companyId;
      
      // Validate the request body
      const ticketData = insertSupportTicketSchema.parse({
        ...req.body,
        userId,
        companyId
      });
      
      const ticket = await storage.createSupportTicket(ticketData);
      
      // Create a notification for the user that their ticket was submitted
      await storage.createNotification({
        userId: userId,
        type: "system",
        title: "Support Ticket Submitted",
        message: `Your support ticket "${ticket.subject}" has been submitted successfully. We'll respond as soon as possible.`,
        relatedId: ticket.id,
        relatedType: "support_ticket"
      });
      
      res.status(201).json(ticket);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          error: "Invalid ticket data", 
          details: error.errors 
        });
      }
      
      console.error("Error creating support ticket:", error);
      res.status(500).json({ error: "Failed to create support ticket" });
    }
  });

  // Update a support ticket (for status changes, etc.)
  app.patch("/api/support/tickets/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const ticketId = parseInt(req.params.id);
      const userId = req.user!.id;
      
      // First verify the ticket belongs to the user
      const existingTickets = await storage.getSupportTicketsByUser(userId);
      const userTicket = existingTickets.find(t => t.id === ticketId);
      
      if (!userTicket) {
        return res.status(404).json({ error: "Support ticket not found" });
      }
      
      const updatedTicket = await storage.updateSupportTicket(ticketId, req.body);
      res.json(updatedTicket);
    } catch (error) {
      console.error("Error updating support ticket:", error);
      res.status(500).json({ error: "Failed to update support ticket" });
    }
  });
}