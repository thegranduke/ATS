import { Express, Request, Response } from "express";
import { storage } from "./storage";

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

// Job status transition rules
const JOB_STATUS_TRANSITIONS = {
  'draft': ['active', 'archived'],
  'active': ['paused', 'closed', 'archived'],
  'paused': ['active', 'closed', 'archived'],
  'closed': ['active', 'archived'],
  'archived': [] // Cannot transition from archived
};

// Candidate status transition rules
const CANDIDATE_STATUS_TRANSITIONS = {
  'applied': ['screening', 'rejected'],
  'screening': ['interview', 'rejected', 'on-hold'],
  'interview': ['offer', 'rejected', 'on-hold'],
  'offer': ['hired', 'rejected', 'withdrawn'],
  'hired': ['archived'],
  'rejected': ['archived'],
  'withdrawn': ['archived'],
  'on-hold': ['screening', 'interview', 'rejected'],
  'archived': [] // Cannot transition from archived
};

export function validateJobStatusTransition(currentStatus: string, newStatus: string): boolean {
  const allowedTransitions = JOB_STATUS_TRANSITIONS[currentStatus as keyof typeof JOB_STATUS_TRANSITIONS];
  return allowedTransitions ? allowedTransitions.includes(newStatus) : false;
}

export function validateCandidateStatusTransition(currentStatus: string, newStatus: string): boolean {
  const allowedTransitions = CANDIDATE_STATUS_TRANSITIONS[currentStatus as keyof typeof CANDIDATE_STATUS_TRANSITIONS];
  return allowedTransitions ? allowedTransitions.includes(newStatus) : false;
}

export function getJobStatusTransitions(currentStatus: string): string[] {
  return JOB_STATUS_TRANSITIONS[currentStatus as keyof typeof JOB_STATUS_TRANSITIONS] || [];
}

export function getCandidateStatusTransitions(currentStatus: string): string[] {
  return CANDIDATE_STATUS_TRANSITIONS[currentStatus as keyof typeof CANDIDATE_STATUS_TRANSITIONS] || [];
}

// Helper function for search term highlighting
export function highlightSearchTerm(text: string, searchTerm: string): string {
  if (!text || !searchTerm) return text || '';
  
  const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

export function setupWorkflowRoutes(app: Express) {
  
  // Get allowed status transitions for a job
  app.get("/api/jobs/:id/status-transitions", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const jobId = parseInt(req.params.id);
      const tenantId = req.activeTenantId || req.user!.companyId;

      const job = await storage.getJobById(jobId);
      if (!job || job.companyId !== tenantId) {
        return res.status(404).json({ error: "Job not found" });
      }

      const allowedTransitions = getJobStatusTransitions(job.status);
      
      res.json({
        currentStatus: job.status,
        allowedTransitions,
        transitionRules: JOB_STATUS_TRANSITIONS
      });

    } catch (error) {
      console.error("Error fetching job status transitions:", error);
      res.status(500).json({ error: "Failed to fetch status transitions" });
    }
  });

  // Update job status with validation
  app.patch("/api/jobs/:id/status", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const jobId = parseInt(req.params.id);
      const { status, reason } = req.body;
      const tenantId = req.activeTenantId || req.user!.companyId;

      if (!status) {
        return res.status(400).json({ error: "Status is required" });
      }

      const job = await storage.getJobById(jobId);
      if (!job || job.companyId !== tenantId) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Validate status transition
      if (!validateJobStatusTransition(job.status, status)) {
        return res.status(400).json({
          error: `Invalid status transition from ${job.status} to ${status}`,
          allowedTransitions: getJobStatusTransitions(job.status)
        });
      }

      // Update job status
      const updatedJob = await storage.updateJob(jobId, { status });

      // Create audit log entry
      console.log(`Job ${jobId} status changed from ${job.status} to ${status} by user ${req.user!.id}${reason ? ` (reason: ${reason})` : ''}`);

      // Create notification for significant status changes
      if (status === 'active' || status === 'closed' || status === 'archived') {
        await storage.createNotification({
          userId: req.user!.id,
          type: 'status_change',
          title: 'Job Status Updated',
          message: `Job "${job.title}" status changed to ${status}`,
          relatedType: 'job',
          relatedId: jobId
        });
      }

      res.json({
        success: true,
        job: updatedJob,
        previousStatus: job.status,
        newStatus: status,
        changedBy: req.user!.id,
        changedAt: new Date().toISOString(),
        reason: reason || null
      });

    } catch (error) {
      console.error("Error updating job status:", error);
      res.status(500).json({ error: "Failed to update job status" });
    }
  });

  // Get allowed status transitions for a candidate
  app.get("/api/candidates/:id/status-transitions", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const candidateId = parseInt(req.params.id);
      const tenantId = req.activeTenantId || req.user!.companyId;

      const candidate = await storage.getCandidateById(candidateId);
      if (!candidate || candidate.companyId !== tenantId) {
        return res.status(404).json({ error: "Candidate not found" });
      }

      const allowedTransitions = getCandidateStatusTransitions(candidate.status);
      
      res.json({
        currentStatus: candidate.status,
        allowedTransitions,
        transitionRules: CANDIDATE_STATUS_TRANSITIONS
      });

    } catch (error) {
      console.error("Error fetching candidate status transitions:", error);
      res.status(500).json({ error: "Failed to fetch status transitions" });
    }
  });

  // Update candidate status with validation
  app.patch("/api/candidates/:id/status", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const candidateId = parseInt(req.params.id);
      const { status, reason, notes } = req.body;
      const tenantId = req.activeTenantId || req.user!.companyId;

      if (!status) {
        return res.status(400).json({ error: "Status is required" });
      }

      const candidate = await storage.getCandidateById(candidateId);
      if (!candidate || candidate.companyId !== tenantId) {
        return res.status(404).json({ error: "Candidate not found" });
      }

      // Validate status transition
      if (!validateCandidateStatusTransition(candidate.status, status)) {
        return res.status(400).json({
          error: `Invalid status transition from ${candidate.status} to ${status}`,
          allowedTransitions: getCandidateStatusTransitions(candidate.status)
        });
      }

      // Update candidate status and notes if provided
      const updateData: any = { status };
      if (notes) {
        updateData.notes = candidate.notes ? `${candidate.notes}\n\n[${new Date().toISOString()}] Status changed to ${status}: ${notes}` : notes;
      }

      const updatedCandidate = await storage.updateCandidate(candidateId, updateData);

      // Create audit log entry
      console.log(`Candidate ${candidateId} status changed from ${candidate.status} to ${status} by user ${req.user!.id}${reason ? ` (reason: ${reason})` : ''}`);

      // Create notification for significant status changes
      if (status === 'hired' || status === 'rejected' || status === 'offer') {
        await storage.createNotification({
          userId: req.user!.id,
          type: 'status_change',
          title: 'Candidate Status Updated',
          message: `Candidate "${candidate.fullName}" status changed to ${status}`,
          relatedType: 'candidate',
          relatedId: candidateId
        });
      }

      res.json({
        success: true,
        candidate: updatedCandidate,
        previousStatus: candidate.status,
        newStatus: status,
        changedBy: req.user!.id,
        changedAt: new Date().toISOString(),
        reason: reason || null
      });

    } catch (error) {
      console.error("Error updating candidate status:", error);
      res.status(500).json({ error: "Failed to update candidate status" });
    }
  });

  // Get status change history for a job
  app.get("/api/jobs/:id/status-history", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const jobId = parseInt(req.params.id);
      const tenantId = req.activeTenantId || req.user!.companyId;

      const job = await storage.getJobById(jobId);
      if (!job || job.companyId !== tenantId) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Get notifications related to this job for status changes
      const notifications = await storage.getNotificationsByUser(req.user!.id);
      const jobStatusNotifications = notifications.filter(n => 
        n.relatedType === 'job' && 
        n.relatedId === jobId && 
        n.type === 'status_change'
      );

      res.json({
        jobId,
        currentStatus: job.status,
        history: jobStatusNotifications.map(n => ({
          status: n.message.includes('active') ? 'active' : 
                 n.message.includes('closed') ? 'closed' : 
                 n.message.includes('archived') ? 'archived' : 'unknown',
          changedAt: n.createdAt,
          message: n.message
        }))
      });

    } catch (error) {
      console.error("Error fetching job status history:", error);
      res.status(500).json({ error: "Failed to fetch status history" });
    }
  });

  // Get status change history for a candidate
  app.get("/api/candidates/:id/status-history", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const candidateId = parseInt(req.params.id);
      const tenantId = req.activeTenantId || req.user!.companyId;

      const candidate = await storage.getCandidateById(candidateId);
      if (!candidate || candidate.companyId !== tenantId) {
        return res.status(404).json({ error: "Candidate not found" });
      }

      // Get notifications related to this candidate for status changes
      const notifications = await storage.getNotificationsByUser(req.user!.id);
      const candidateStatusNotifications = notifications.filter(n => 
        n.relatedType === 'candidate' && 
        n.relatedId === candidateId && 
        n.type === 'status_change'
      );

      res.json({
        candidateId,
        currentStatus: candidate.status,
        history: candidateStatusNotifications.map(n => ({
          status: n.message.includes('hired') ? 'hired' : 
                 n.message.includes('rejected') ? 'rejected' : 
                 n.message.includes('offer') ? 'offer' : 'unknown',
          changedAt: n.createdAt,
          message: n.message
        }))
      });

    } catch (error) {
      console.error("Error fetching candidate status history:", error);
      res.status(500).json({ error: "Failed to fetch status history" });
    }
  });
}