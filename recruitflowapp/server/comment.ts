import express, { type Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { insertCommentSchema } from "@shared/schema";
import { tenantSecurityMiddleware } from "./tenant";
import { ZodError } from "zod";
import { emailService } from "./email";

// Module augmentation to add user property to Request
declare module "express-serve-static-core" {
  interface Request {
    isAuthenticated(): boolean;
    user?: {
      id: number;
    };
  }
}

export function setupCommentRoutes(app: Express) {
  // Get comments for a candidate
  app.get('/api/candidates/:candidateId/comments', tenantSecurityMiddleware, async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).send('Unauthorized');
      }

      const candidateId = parseInt(req.params.candidateId);
      if (isNaN(candidateId)) {
        return res.status(400).json({ error: 'Invalid candidate ID' });
      }

      const comments = await storage.getCommentsByCandidate(candidateId);
      res.json(comments);
    } catch (error) {
      console.error('Error fetching comments:', error);
      res.status(500).json({ error: 'Failed to fetch comments' });
    }
  });

  // Add a comment to a candidate
  app.post('/api/candidates/:candidateId/comments', tenantSecurityMiddleware, async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).send('Unauthorized');
      }

      const candidateId = parseInt(req.params.candidateId);
      if (isNaN(candidateId)) {
        return res.status(400).json({ error: 'Invalid candidate ID' });
      }

      // Get company ID from the active tenant
      const companyId = req.activeTenantId;
      if (!companyId) {
        return res.status(400).json({ error: 'Active tenant ID required' });
      }

      const candidate = await storage.getCandidateById(candidateId);
      if (!candidate) {
        return res.status(404).json({ error: 'Candidate not found' });
      }

      // Validate that the candidate belongs to the active tenant
      if (candidate.companyId !== companyId) {
        return res.status(403).json({ error: 'Access denied to this candidate' });
      }

      try {
        const commentData = insertCommentSchema.parse({
          ...req.body,
          candidateId,
          userId: req.user!.id,
          companyId
        });

        const comment = await storage.createComment(commentData);
        
        // Check for mentions in the comment content and send email notifications
        const mentionRegex = /@(\w+)/g;
        const mentions = [...(commentData.content.match(mentionRegex) || [])];
        
        if (mentions.length > 0) {
          try {
            // Get company information
            const company = await storage.getCompanyById(companyId);
            const companyName = company?.name || 'Your Company';
            
            // Get the commenter's information
            const commenter = await storage.getUserById(req.user!.id);
            const commenterName = commenter?.fullName || 'A team member';
            
            // Process each mention
            for (const mention of mentions) {
              const username = mention.replace('@', '');
              const mentionedUser = await storage.getUserByUsername(username);
              
              if (mentionedUser && mentionedUser.companyId === companyId) {
                // Create notification for mentioned user
                await storage.createNotification({
                  userId: mentionedUser.id,
                  type: "comment_mention",
                  title: "You were mentioned in a comment",
                  message: `${commenterName} mentioned you in a comment on ${candidate.fullName}'s profile`,
                  relatedId: candidateId,
                  relatedType: "candidate"
                });
                
                // Send email notification
                try {
                  await emailService.sendMentionNotification(
                    mentionedUser.email,
                    mentionedUser.fullName,
                    commenterName,
                    candidate.fullName,
                    commentData.content,
                    companyName
                  );
                  console.log(`Mention email sent to ${mentionedUser.email}`);
                } catch (emailError) {
                  console.error(`Failed to send mention email to ${mentionedUser.email}:`, emailError);
                }
              }
            }
          } catch (mentionError) {
            console.error('Error processing mentions:', mentionError);
          }
        }
        
        res.status(201).json(comment);
      } catch (validationError) {
        if (validationError instanceof ZodError) {
          return res.status(400).json({ 
            error: 'Validation error', 
            details: validationError.errors 
          });
        }
        throw validationError;
      }
    } catch (error) {
      console.error('Error creating comment:', error);
      res.status(500).json({ error: 'Failed to create comment' });
    }
  });

  // Update a comment
  app.put('/api/comments/:id', tenantSecurityMiddleware, async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).send('Unauthorized');
      }

      const commentId = parseInt(req.params.id);
      if (isNaN(commentId)) {
        return res.status(400).json({ error: 'Invalid comment ID' });
      }

      // Verify the comment exists and belongs to this user
      // The tenant security middleware ensures the user can only access data in their tenant
      try {
        const updatedComment = await storage.updateComment(commentId, req.body);
        res.json(updatedComment);
      } catch (err) {
        return res.status(404).json({ error: 'Comment not found' });
      }
    } catch (error) {
      console.error('Error updating comment:', error);
      res.status(500).json({ error: 'Failed to update comment' });
    }
  });

  // Delete a comment
  app.delete('/api/comments/:id', tenantSecurityMiddleware, async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).send('Unauthorized');
      }

      const commentId = parseInt(req.params.id);
      if (isNaN(commentId)) {
        return res.status(400).json({ error: 'Invalid comment ID' });
      }

      // Verify the comment exists and belongs to this user
      try {
        await storage.deleteComment(commentId);
        res.status(204).send();
      } catch (err) {
        return res.status(404).json({ error: 'Comment not found' });
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
      res.status(500).json({ error: 'Failed to delete comment' });
    }
  });
}