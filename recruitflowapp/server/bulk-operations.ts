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

// Validation schemas for bulk operations
const bulkJobActionSchema = z.object({
  jobIds: z.array(z.number()).min(1).max(100),
  action: z.enum(['delete', 'archive', 'activate', 'pause', 'close']),
  reason: z.string().optional()
});

const bulkCandidateActionSchema = z.object({
  candidateIds: z.array(z.number()).min(1).max(100),
  action: z.enum(['delete', 'archive', 'reject', 'move-to-screening', 'move-to-interview']),
  reason: z.string().optional(),
  notes: z.string().optional()
});

// Transaction log for rollback capability
interface BulkOperationLog {
  id: string;
  userId: number;
  companyId: number;
  action: string;
  entityType: 'job' | 'candidate';
  timestamp: Date;
  originalData: any[];
  affectedIds: number[];
  rollbackData?: any[];
}

class BulkOperationManager {
  private operationLogs: Map<string, BulkOperationLog> = new Map();

  generateOperationId(): string {
    return `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async logOperation(log: BulkOperationLog): Promise<void> {
    this.operationLogs.set(log.id, log);
    // In production, this would be stored in database
    console.log(`Bulk operation logged: ${log.id} - ${log.action} on ${log.affectedIds.length} ${log.entityType}s`);
  }

  async getOperationLog(operationId: string): Promise<BulkOperationLog | undefined> {
    return this.operationLogs.get(operationId);
  }

  async rollbackOperation(operationId: string, userId: number): Promise<boolean> {
    const log = this.operationLogs.get(operationId);
    if (!log) return false;

    // Verify user can rollback (same user or admin)
    const user = await storage.getUser(userId);
    if (!user || (log.userId !== userId && user.role !== 'admin')) {
      return false;
    }

    try {
      if (log.entityType === 'job' && log.rollbackData) {
        // Restore jobs from rollback data
        for (const jobData of log.rollbackData) {
          if (log.action === 'delete') {
            // Recreate deleted jobs
            await storage.createJob(jobData);
          } else {
            // Restore previous state
            await storage.updateJob(jobData.id, jobData);
          }
        }
      } else if (log.entityType === 'candidate' && log.rollbackData) {
        // Restore candidates from rollback data
        for (const candidateData of log.rollbackData) {
          if (log.action === 'delete') {
            // Recreate deleted candidates
            await storage.createCandidate(candidateData);
          } else {
            // Restore previous state
            await storage.updateCandidate(candidateData.id, candidateData);
          }
        }
      }

      console.log(`Bulk operation ${operationId} rolled back successfully by user ${userId}`);
      return true;
    } catch (error) {
      console.error(`Failed to rollback operation ${operationId}:`, error);
      return false;
    }
  }
}

const bulkManager = new BulkOperationManager();

export function setupBulkOperationRoutes(app: Express) {
  
  // Bulk job operations
  app.post("/api/jobs/bulk", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Validate request
      const validationResult = bulkJobActionSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Invalid bulk operation data",
          details: validationResult.error.errors
        });
      }

      const { jobIds, action, reason } = validationResult.data;
      const tenantId = req.activeTenantId || req.user!.companyId;
      const operationId = bulkManager.generateOperationId();

      // Verify all jobs belong to the company and get original data
      const jobs = [];
      const originalData = [];
      
      for (const jobId of jobIds) {
        const job = await storage.getJobById(jobId);
        if (!job || job.companyId !== tenantId) {
          return res.status(404).json({ 
            error: `Job ${jobId} not found or access denied` 
          });
        }
        jobs.push(job);
        originalData.push({ ...job });
      }

      const results = [];
      const rollbackData = [];
      let successCount = 0;
      let errorCount = 0;

      // Execute bulk action
      for (const job of jobs) {
        try {
          let result;
          const rollbackEntry = { ...job };

          switch (action) {
            case 'delete':
              await storage.deleteJob(job.id);
              result = { id: job.id, action: 'deleted', success: true };
              rollbackData.push(rollbackEntry);
              break;

            case 'archive':
              result = await storage.updateJob(job.id, { status: 'archived' });
              rollbackData.push(rollbackEntry);
              break;

            case 'activate':
              result = await storage.updateJob(job.id, { status: 'active' });
              rollbackData.push(rollbackEntry);
              break;

            case 'pause':
              result = await storage.updateJob(job.id, { status: 'paused' });
              rollbackData.push(rollbackEntry);
              break;

            case 'close':
              result = await storage.updateJob(job.id, { status: 'closed' });
              rollbackData.push(rollbackEntry);
              break;

            default:
              throw new Error(`Unknown action: ${action}`);
          }

          results.push({
            id: job.id,
            title: job.title,
            action,
            success: true,
            result
          });
          successCount++;

        } catch (error) {
          results.push({
            id: job.id,
            title: job.title,
            action,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          errorCount++;
        }
      }

      // Log operation for potential rollback
      await bulkManager.logOperation({
        id: operationId,
        userId: req.user!.id,
        companyId: tenantId,
        action,
        entityType: 'job',
        timestamp: new Date(),
        originalData,
        affectedIds: jobIds,
        rollbackData
      });

      // Create notification for successful bulk operations
      if (successCount > 0) {
        await storage.createNotification({
          userId: req.user!.id,
          type: 'system',
          title: 'Bulk Operation Completed',
          message: `Successfully ${action}d ${successCount} job${successCount > 1 ? 's' : ''}${reason ? ` (${reason})` : ''}`,
          relatedType: 'bulk_operation',
          relatedId: null
        });
      }

      res.json({
        success: true,
        operationId,
        summary: {
          total: jobIds.length,
          successful: successCount,
          failed: errorCount,
          action
        },
        results,
        rollbackAvailable: true,
        reason: reason || null
      });

    } catch (error) {
      console.error("Bulk job operation error:", error);
      res.status(500).json({ error: "Failed to execute bulk operation" });
    }
  });

  // Bulk candidate operations
  app.post("/api/candidates/bulk", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Validate request
      const validationResult = bulkCandidateActionSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Invalid bulk operation data",
          details: validationResult.error.errors
        });
      }

      const { candidateIds, action, reason, notes } = validationResult.data;
      const tenantId = req.activeTenantId || req.user!.companyId;
      const operationId = bulkManager.generateOperationId();

      // Verify all candidates belong to the company and get original data
      const candidates = [];
      const originalData = [];
      
      for (const candidateId of candidateIds) {
        const candidate = await storage.getCandidateById(candidateId);
        if (!candidate || candidate.companyId !== tenantId) {
          return res.status(404).json({ 
            error: `Candidate ${candidateId} not found or access denied` 
          });
        }
        candidates.push(candidate);
        originalData.push({ ...candidate });
      }

      const results = [];
      const rollbackData = [];
      let successCount = 0;
      let errorCount = 0;

      // Execute bulk action
      for (const candidate of candidates) {
        try {
          let result;
          const rollbackEntry = { ...candidate };

          switch (action) {
            case 'delete':
              await storage.deleteCandidate(candidate.id);
              result = { id: candidate.id, action: 'deleted', success: true };
              rollbackData.push(rollbackEntry);
              break;

            case 'archive':
              result = await storage.updateCandidate(candidate.id, { status: 'archived' });
              rollbackData.push(rollbackEntry);
              break;

            case 'reject':
              const rejectNotes = notes ? `${candidate.notes || ''}\n\n[${new Date().toISOString()}] Bulk rejected: ${notes}` : candidate.notes;
              result = await storage.updateCandidate(candidate.id, { 
                status: 'rejected',
                notes: rejectNotes
              });
              rollbackData.push(rollbackEntry);
              break;

            case 'move-to-screening':
              result = await storage.updateCandidate(candidate.id, { status: 'screening' });
              rollbackData.push(rollbackEntry);
              break;

            case 'move-to-interview':
              result = await storage.updateCandidate(candidate.id, { status: 'interview' });
              rollbackData.push(rollbackEntry);
              break;

            default:
              throw new Error(`Unknown action: ${action}`);
          }

          results.push({
            id: candidate.id,
            fullName: candidate.fullName,
            email: candidate.email,
            action,
            success: true,
            result
          });
          successCount++;

        } catch (error) {
          results.push({
            id: candidate.id,
            fullName: candidate.fullName,
            email: candidate.email,
            action,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          errorCount++;
        }
      }

      // Log operation for potential rollback
      await bulkManager.logOperation({
        id: operationId,
        userId: req.user!.id,
        companyId: tenantId,
        action,
        entityType: 'candidate',
        timestamp: new Date(),
        originalData,
        affectedIds: candidateIds,
        rollbackData
      });

      // Create notification for successful bulk operations
      if (successCount > 0) {
        await storage.createNotification({
          userId: req.user!.id,
          type: 'system',
          title: 'Bulk Operation Completed',
          message: `Successfully processed ${successCount} candidate${successCount > 1 ? 's' : ''} (${action})${reason ? ` - ${reason}` : ''}`,
          relatedType: 'bulk_operation',
          relatedId: null
        });
      }

      res.json({
        success: true,
        operationId,
        summary: {
          total: candidateIds.length,
          successful: successCount,
          failed: errorCount,
          action
        },
        results,
        rollbackAvailable: true,
        reason: reason || null
      });

    } catch (error) {
      console.error("Bulk candidate operation error:", error);
      res.status(500).json({ error: "Failed to execute bulk operation" });
    }
  });

  // Rollback bulk operation
  app.post("/api/bulk-operations/:operationId/rollback", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const operationId = req.params.operationId;
      const { confirm } = req.body;

      if (!confirm) {
        return res.status(400).json({ error: "Rollback confirmation required" });
      }

      const success = await bulkManager.rollbackOperation(operationId, req.user!.id);

      if (success) {
        // Create notification for rollback
        await storage.createNotification({
          userId: req.user!.id,
          type: 'system',
          title: 'Bulk Operation Rolled Back',
          message: `Bulk operation ${operationId} has been successfully rolled back`,
          relatedType: 'bulk_operation',
          relatedId: null
        });

        res.json({
          success: true,
          message: "Bulk operation rolled back successfully",
          operationId
        });
      } else {
        res.status(400).json({
          error: "Failed to rollback operation. Operation may not exist or you may not have permission."
        });
      }

    } catch (error) {
      console.error("Rollback operation error:", error);
      res.status(500).json({ error: "Failed to rollback operation" });
    }
  });

  // Get bulk operation history
  app.get("/api/bulk-operations", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const tenantId = req.activeTenantId || req.user!.companyId;
      const { limit = 20, offset = 0 } = req.query;

      // Get operations for the company (simplified - in production this would be from database)
      const allOperations = Array.from(bulkManager['operationLogs'].values())
        .filter(op => op.companyId === tenantId)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string));

      const operations = allOperations.map(op => ({
        id: op.id,
        action: op.action,
        entityType: op.entityType,
        timestamp: op.timestamp,
        affectedCount: op.affectedIds.length,
        rollbackAvailable: !!op.rollbackData
      }));

      res.json({
        operations,
        total: Array.from(bulkManager['operationLogs'].values()).filter(op => op.companyId === tenantId).length,
        hasMore: parseInt(offset as string) + parseInt(limit as string) < operations.length
      });

    } catch (error) {
      console.error("Error fetching bulk operations:", error);
      res.status(500).json({ error: "Failed to fetch bulk operations" });
    }
  });

  // Get specific bulk operation details
  app.get("/api/bulk-operations/:operationId", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const operationId = req.params.operationId;
      const tenantId = req.activeTenantId || req.user!.companyId;

      const operation = await bulkManager.getOperationLog(operationId);
      
      if (!operation || operation.companyId !== tenantId) {
        return res.status(404).json({ error: "Operation not found" });
      }

      res.json({
        id: operation.id,
        action: operation.action,
        entityType: operation.entityType,
        timestamp: operation.timestamp,
        affectedIds: operation.affectedIds,
        affectedCount: operation.affectedIds.length,
        rollbackAvailable: !!operation.rollbackData,
        originalData: operation.originalData
      });

    } catch (error) {
      console.error("Error fetching bulk operation details:", error);
      res.status(500).json({ error: "Failed to fetch operation details" });
    }
  });
}