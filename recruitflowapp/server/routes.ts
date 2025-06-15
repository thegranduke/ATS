import express, { type Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, generateApplicationLink, hashPassword, comparePasswords } from "./auth";
import { insertJobSchema, insertCandidateSchema, applicationFormSchema, brokerkitIntegrationSchema, insertJobViewSchema, insertLocationSchema } from "@shared/schema";
import { ZodError } from "zod";
import { setupTenantManagement, tenantSecurityMiddleware } from "./tenant";
import { setupAvatarRoutes } from "./avatar";
import { setupDocumentRoutes } from "./document";
import { setupCommentRoutes } from "./comment";
import { setupLocationRoutes } from "./location";
import { setupNotificationRoutes, createCandidateApplicationNotification } from "./notification";
import { setupSupportRoutes } from "./support";
import { setupResumeUploadRoutes } from "./resume-upload";
import { setupCompanyLogoRoutes } from "./company-logo";
import { emailService } from "./email";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";

// Use imported tenantSecurityMiddleware from tenant.ts

export async function registerRoutes(app: Express): Promise<Server> {
  // --- Public API Routes ---
  // These routes are for public access (e.g., application forms) and
  // are intentionally placed BEFORE any authentication or security middleware.

  // Application submission endpoint
  app.post("/api/applications", async (req, res) => {
    try {
      console.log("Application submission received:", req.body);
      
      const validatedData = applicationFormSchema.parse(req.body);
      console.log("Application data validated successfully");
      
      // Get job by application link
      const job = await storage.getJobByApplicationLink(validatedData.applicationLink);
      if (!job) {
        console.log("Job not found for application link:", validatedData.applicationLink);
        return res.status(404).json({ error: "Job not found" });
      }
      
      console.log("Job found:", job.title, "for company:", job.companyId);
      
      // Create candidate record
      const candidate = await storage.createCandidate({
        fullName: validatedData.fullName,
        email: validatedData.email,
        phone: validatedData.phone || null,
        resumeUrl: validatedData.resumeUrl || null,
        jobId: job.id,
        companyId: job.companyId,
        status: "new",
        notes: null, // validatedData.coverLetter is not in the schema
        isLicensed: validatedData.isLicensed,
        wantsLicense: validatedData.wantsLicense,
        agreedToMarketing: validatedData.agreedToMarketing,
      });
      
      console.log("Candidate created with ID:", candidate.id);
      
      // Create notification for new candidate application
      await createCandidateApplicationNotification(candidate, job);
      console.log("Notification created for new candidate application");
      
      // Track application form analytics
      if (validatedData.sessionId) {
        try {
          await storage.updateApplicationFormAnalytics(validatedData.sessionId, {
            completed: true,
            completedAt: new Date(),
            candidateId: candidate.id,
            conversionStep: 'application_submitted'
          });
          console.log("Application form analytics updated for session:", validatedData.sessionId);
        } catch (analyticsError) {
          console.error("Error updating application analytics:", analyticsError);
        }
      }
      
      res.status(201).json({ 
        success: true, 
        message: "Application submitted successfully",
        candidateId: candidate.id 
      });
      
    } catch (error) {
      console.error("Application submission error:", error);
      
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          error: "Invalid application data", 
          details: error.errors 
        });
      }
      
      res.status(500).json({ 
        error: "Failed to submit application",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Fetch job data for public application pages
  app.get("/api/application/:link", async (req, res) => {
    const job = await storage.getJobByApplicationLink(req.params.link);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    const company = await storage.getCompanyById(job.companyId);
    res.json({ ...job, company });
  });

  app.get("/api/application/job/:jobId/:shortCode", async (req, res) => {
    const { jobId, shortCode } = req.params;
    const constructedLink = `${jobId}-${shortCode}`;
    const job = await storage.getJobByApplicationLink(constructedLink);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    const company = await storage.getCompanyById(job.companyId);
    res.json({ ...job, company });
  });

  // --- Authentication & Security Middleware ---
  // All routes registered after this point are protected and require a valid session.

  // Set up authentication routes (e.g., login, logout, user status)
  setupAuth(app);
  
  // Set up multi-tenant management
  setupTenantManagement(app);
  
  // Configure routes to access static files
  console.log("Setting up static directory for uploads:", path.join(process.cwd(), 'public', 'uploads'));
  app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));
  
  // Apply tenant security middleware to all subsequent /api routes
  app.use("/api", tenantSecurityMiddleware);

  // --- Protected API Routes ---
  // All routes below this line are now protected.

  // Set up avatar management routes
  setupAvatarRoutes(app);
  
  // Set up document management routes
  setupDocumentRoutes(app);
  
  // Set up comment management routes
  setupCommentRoutes(app);
  
  // Set up location management routes
  setupLocationRoutes(app);
  
  // Set up notification routes
  setupNotificationRoutes(app);
  
  // Set up support ticket routes
  setupSupportRoutes(app);
  
  // Set up resume upload routes
  setupResumeUploadRoutes(app);
  
  // Set up company logo routes
  setupCompanyLogoRoutes(app);
  
  // Location API Routes are now managed through the setupLocationRoutes module
  
  // Serve everything in public/uploads directly
  console.log("Setting up static directory for uploads:", path.join(process.cwd(), 'public', 'uploads'));
  app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));
  
  // Add a direct test route to diagnose avatar serving
  app.get('/check-avatar-files', (req, res) => {
    const avatarsDir = path.join(process.cwd(), 'public', 'uploads', 'avatars');
    try {
      if (!fs.existsSync(avatarsDir)) {
        return res.status(404).json({ error: 'Avatars directory does not exist', path: avatarsDir });
      }
      
      const files = fs.readdirSync(avatarsDir);
      return res.json({ 
        success: true, 
        message: 'Avatars directory exists',
        path: avatarsDir,
        files: files,
        count: files.length
      });
    } catch (error) {
      return res.status(500).json({ 
        error: 'Error accessing avatars directory', 
        message: error instanceof Error ? error.message : String(error),
        path: avatarsDir
      });
    }
  });
  
  // Add tenant security middleware to all protected routes
  app.use("/api", tenantSecurityMiddleware);

  // Enhanced Jobs API with search and filtering
  app.get("/api/jobs", async (req, res) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated()) {
        console.log("Unauthorized attempt to fetch jobs");
        return res.status(401).json({ error: "Unauthorized" });
      }
  
      // Use active tenant ID (set by middleware) or fall back to user's primary company
      const tenantId = req.activeTenantId || req.user!.companyId;
      
      // Extract search and filter parameters
      const {
        search,
        status,
        type,
        experience,
        location,
        dateRange,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        page = '1',
        limit = '50'
      } = req.query;
      
      console.log(`Fetching jobs for tenant ID: ${tenantId} with filters:`, {
        search, status, type, experience, location, dateRange, sortBy, sortOrder
      });
  
      // Get jobs for the tenant
      let jobs = await storage.getJobsByCompany(tenantId);
      
      // Apply search filter
      if (search && typeof search === 'string') {
        const searchLower = search.toLowerCase();
        jobs = jobs.filter(job => 
          job.title.toLowerCase().includes(searchLower) ||
          job.department.toLowerCase().includes(searchLower) ||
          job.description.toLowerCase().includes(searchLower)
        );
      }
      
      // Apply status filter
      if (status && status !== 'all_statuses' && typeof status === 'string') {
        jobs = jobs.filter(job => job.status === status);
      }
      
      // Apply type filter
      if (type && type !== 'all_types' && typeof type === 'string') {
        jobs = jobs.filter(job => job.type === type);
      }
      
      // Apply experience filter
      if (experience && experience !== 'all_experience' && typeof experience === 'string') {
        jobs = jobs.filter(job => job.experience === experience);
      }
      
      // Apply date range filter
      if (dateRange && dateRange !== 'all_time' && typeof dateRange === 'string') {
        const now = new Date();
        let startDate: Date;
        
        switch (dateRange) {
          case 'last_7_days':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'last_30_days':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case 'last_90_days':
            startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
          default:
            startDate = new Date(0); // No filter
        }
        
        jobs = jobs.filter(job => new Date(job.createdAt) >= startDate);
      }
      
      // Apply sorting
      jobs.sort((a, b) => {
        let aValue: any, bValue: any;
        
        switch (sortBy) {
          case 'title':
            aValue = a.title.toLowerCase();
            bValue = b.title.toLowerCase();
            break;
          case 'status':
            aValue = a.status;
            bValue = b.status;
            break;
          case 'createdAt':
          default:
            aValue = new Date(a.createdAt).getTime();
            bValue = new Date(b.createdAt).getTime();
        }
        
        if (sortOrder === 'asc') {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        } else {
          return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        }
      });
      
      // Apply pagination
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const startIndex = (pageNum - 1) * limitNum;
      const endIndex = startIndex + limitNum;
      
      const paginatedJobs = jobs.slice(startIndex, endIndex);
      
      console.log(`Retrieved ${jobs.length} total jobs, returning ${paginatedJobs.length} for page ${pageNum}`);
      
      res.json({
        jobs: paginatedJobs,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(jobs.length / limitNum),
          totalJobs: jobs.length,
          hasNextPage: endIndex < jobs.length,
          hasPreviousPage: pageNum > 1
        }
      });
      
    } catch (error) {
      console.error("Error fetching jobs:", error);
      res.status(500).json({ error: "Failed to fetch jobs" });
    }
  });

  // Bulk operations for jobs
  app.post("/api/jobs/bulk", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { action, jobIds } = req.body;
      const tenantId = req.activeTenantId || req.user!.companyId;

      if (!action || !Array.isArray(jobIds) || jobIds.length === 0) {
        return res.status(400).json({ error: "Invalid bulk operation request" });
      }

      console.log(`Bulk ${action} operation for ${jobIds.length} jobs in tenant ${tenantId}`);

      const results = [];
      const errors = [];

      for (const jobId of jobIds) {
        try {
          // Verify job belongs to tenant before operation
          const job = await storage.getJobById(jobId);
          if (!job || job.companyId !== tenantId) {
            errors.push({ jobId, error: "Job not found or access denied" });
            continue;
          }

          switch (action) {
            case 'delete':
              await storage.deleteJob(jobId);
              results.push({ jobId, status: 'deleted' });
              break;
            case 'activate':
              await storage.updateJob(jobId, { ...job, status: 'active' });
              results.push({ jobId, status: 'activated' });
              break;
            case 'deactivate':
              await storage.updateJob(jobId, { ...job, status: 'inactive' });
              results.push({ jobId, status: 'deactivated' });
              break;
            case 'archive':
              await storage.updateJob(jobId, { ...job, status: 'archived' });
              results.push({ jobId, status: 'archived' });
              break;
            default:
              errors.push({ jobId, error: `Unknown action: ${action}` });
          }
        } catch (error) {
          console.error(`Error in bulk operation for job ${jobId}:`, error);
          errors.push({ 
            jobId, 
            error: error instanceof Error ? error.message : "Unknown error" 
          });
        }
      }

      res.json({
        success: results.length > 0,
        results,
        errors,
        summary: {
          total: jobIds.length,
          successful: results.length,
          failed: errors.length
        }
      });

    } catch (error) {
      console.error("Bulk jobs operation error:", error);
      res.status(500).json({ error: "Failed to perform bulk operation" });
    }
  });

  app.post("/api/jobs", async (req, res) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated()) {
        console.log("Unauthorized attempt to create job");
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      // Use active tenant ID (set by middleware) or fall back to user's primary company
      const tenantId = req.activeTenantId || req.user!.companyId;
      console.log(`Creating job for tenant ID: ${tenantId}`, JSON.stringify(req.body));
      
      if (!req.body) {
        console.error("Empty request body received");
        return res.status(400).json({ error: "Request body is empty" });
      }
      
      // Ensure companyId is correctly set in the job data
      const jobData = {
        ...req.body,
        companyId: tenantId
      };
      
      console.log("Job data prepared for validation:", JSON.stringify(jobData));
      
      try {
        // Validate and parse the request body
        const validatedJobData = insertJobSchema.parse(jobData);
        console.log("Job data passed validation:", JSON.stringify(validatedJobData));
        
        // Generate a unique application link for the job
        const applicationLink = generateApplicationLink();
        console.log(`Generated application link: ${applicationLink}`);
        
        // Create the job
        const job = await storage.createJob({
          ...validatedJobData,
          applicationLink
        });
        
        console.log(`Job created successfully with ID: ${job.id}`);
        return res.status(201).json(job);
      } catch (validationError) {
        if (validationError instanceof ZodError) {
          console.error("Job creation validation error:", JSON.stringify(validationError.errors));
          return res.status(400).json({ 
            error: "Validation error", 
            details: validationError.errors 
          });
        }
        throw validationError; // rethrow if it's not a ZodError
      }
    } catch (error) {
      console.error("Job creation error:", error);
      return res.status(500).json({ 
        error: "Failed to create job", 
        message: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  app.get("/api/jobs/:id", async (req, res) => {
    const jobId = parseInt(req.params.id);
    const companyId = req.user!.companyId;
    
    const job = await storage.getJobById(jobId);
    
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    
    if (job.companyId !== companyId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    res.json(job);
  });

  app.put("/api/jobs/:id", async (req, res) => {
    try {
      // Verify authentication
      if (!req.isAuthenticated()) {
        console.log("Unauthorized attempt to update job");
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const jobId = parseInt(req.params.id);
      const companyId = req.user!.companyId;
      console.log(`Updating job ID: ${jobId} for company ID: ${companyId}`);
      
      // Find job and verify ownership
      const job = await storage.getJobById(jobId);
      
      if (!job) {
        console.log(`Job not found with ID: ${jobId}`);
        return res.status(404).json({ error: "Job not found" });
      }
      
      if (job.companyId !== companyId) {
        console.log(`Access denied: Job belongs to company ${job.companyId}, not ${companyId}`);
        return res.status(403).json({ error: "Access denied" });
      }
      
      console.log("Received job update data:", JSON.stringify(req.body));
      
      // Validate and parse the job data
      try {
        const jobData = insertJobSchema.parse({
          ...req.body,
          companyId
        });
        
        // Update the job
        const updatedJob = await storage.updateJob(jobId, jobData);
        console.log(`Job updated successfully, ID: ${updatedJob.id}`);
        res.json(updatedJob);
      } catch (validationError) {
        if (validationError instanceof ZodError) {
          console.error("Job update validation error:", JSON.stringify(validationError.errors));
          return res.status(400).json({ 
            error: "Validation error", 
            details: validationError.errors 
          });
        }
        throw validationError; // rethrow if it's not a ZodError
      }
    } catch (error) {
      console.error("Job update error:", error);
      res.status(500).json({ error: "Failed to update job" });
    }
  });

  app.patch("/api/jobs/:id/status", async (req, res) => {
    try {
      // Verify authentication
      if (!req.isAuthenticated()) {
        console.log("Unauthorized attempt to update job status");
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const jobId = parseInt(req.params.id);
      const companyId = req.user!.companyId;
      const { status } = req.body;
      
      console.log(`Updating status for job ID: ${jobId} to ${status} for company ID: ${companyId}`);
      
      // Find job and verify ownership
      const job = await storage.getJobById(jobId);
      
      if (!job) {
        console.log(`Job not found with ID: ${jobId}`);
        return res.status(404).json({ error: "Job not found" });
      }
      
      if (job.companyId !== companyId) {
        console.log(`Access denied: Job belongs to company ${job.companyId}, not ${companyId}`);
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Create a copy of the job with updated status
      const updatedJob = await storage.updateJob(jobId, { 
        ...job, 
        status 
      });
      
      console.log(`Job status updated successfully, ID: ${jobId}, New status: ${status}`);
      res.json(updatedJob);
    } catch (error) {
      console.error("Job status update error:", error);
      res.status(500).json({ error: "Failed to update job status" });
    }
  });

  app.delete("/api/jobs/:id", async (req, res) => {
    try {
      // Verify authentication
      if (!req.isAuthenticated()) {
        console.log("Unauthorized attempt to delete job");
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const jobId = parseInt(req.params.id);
      const companyId = req.user!.companyId;
      console.log(`Deleting job ID: ${jobId} for company ID: ${companyId}`);
      
      // Find job and verify ownership
      const job = await storage.getJobById(jobId);
      
      if (!job) {
        console.log(`Job not found with ID: ${jobId}`);
        return res.status(404).json({ error: "Job not found" });
      }
      
      if (job.companyId !== companyId) {
        console.log(`Access denied: Job belongs to company ${job.companyId}, not ${companyId}`);
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Delete the job
      await storage.deleteJob(jobId);
      console.log(`Job deleted successfully, ID: ${jobId}`);
      res.status(204).send();
    } catch (error) {
      console.error("Job deletion error:", error);
      res.status(500).json({ error: "Failed to delete job" });
    }
  });

  // Application page - publicly accessible (legacy format)
  app.get("/api/application/:link", async (req, res) => {
    const applicationLink = req.params.link;
    const job = await storage.getJobByApplicationLink(applicationLink);
    
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    
    // Return all job details for the application page
    res.json({
      id: job.id,
      title: job.title,
      company: await storage.getCompanyById(job.companyId),
      description: job.description,
      location: job.location,
      type: job.type,
      department: job.department,
      category: job.category,
      experience: job.experience,
      country: job.country,
      state: job.state,
      city: job.city,
      salaryStart: job.salaryStart,
      salaryEnd: job.salaryEnd,
      paymentType: job.paymentType,
      currency: job.currency,
      education: job.education,
      enablePhone: job.enablePhone,
      requirePhone: job.requirePhone,
      enableAddress: job.enableAddress,
      requireAddress: job.requireAddress,
      showLicenseOptions: job.showLicenseOptions,
      licenseStateName: job.licenseStateName,
      requireResume: job.requireResume
    });
  });
  
  // Application page - publicly accessible (short format with job ID and shortcode)
  app.get("/api/application/job/:jobId/:shortCode", async (req, res) => {
    const { jobId, shortCode } = req.params;
    
    // Construct application link from jobId and shortCode
    const constructedLink = `${jobId}-${shortCode}`;
    console.log(`Short format application link: constructed ${constructedLink} from jobId=${jobId} and shortCode=${shortCode}`);
    
    // Look up the job using the constructed link
    const job = await storage.getJobByApplicationLink(constructedLink);
    
    if (!job) {
      console.log(`Job not found for constructed application link: ${constructedLink}`);
      return res.status(404).json({ error: "Job not found" });
    }
    
    // Return all job details for the application page
    res.json({
      id: job.id,
      title: job.title,
      company: await storage.getCompanyById(job.companyId),
      description: job.description,
      location: job.location,
      type: job.type,
      department: job.department,
      category: job.category,
      experience: job.experience,
      country: job.country,
      state: job.state,
      city: job.city,
      salaryStart: job.salaryStart,
      salaryEnd: job.salaryEnd,
      paymentType: job.paymentType,
      currency: job.currency,
      education: job.education,
      enablePhone: job.enablePhone,
      requirePhone: job.requirePhone,
      enableAddress: job.enableAddress,
      requireAddress: job.requireAddress,
      showLicenseOptions: job.showLicenseOptions,
      licenseStateName: job.licenseStateName,
      requireResume: job.requireResume
    });
  });

  // Set up document upload for applications
  const applicationDocumentsDir = path.join(process.cwd(), 'public', 'uploads', 'documents');
  
  // Ensure the documents directory exists
  if (!fs.existsSync(applicationDocumentsDir)) {
    fs.mkdirSync(applicationDocumentsDir, { recursive: true });
    console.log("Created application documents directory:", applicationDocumentsDir);
  }
  
  // Configure multer for document uploads
  const applicationDocumentStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, applicationDocumentsDir);
    },
    filename: function (req, file, cb) {
      const fileExtension = path.extname(file.originalname);
      const uniqueFilename = `${uuidv4()}${fileExtension}`;
      cb(null, uniqueFilename);
    }
  });
  
  const applicationDocumentUpload = multer({
    storage: applicationDocumentStorage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max file size
    },
    fileFilter: function (req, file, cb) {
      // Accept only common document formats
      const allowedFileTypes = ['.pdf', '.doc', '.docx', '.txt', '.rtf'];
      const ext = path.extname(file.originalname).toLowerCase();
      
      if (allowedFileTypes.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error('Only document files are allowed'));
      }
    }
  });
  
  // Document upload endpoint for application (legacy URL format)
  app.post("/api/application/:link/document", applicationDocumentUpload.single('document'), async (req, res) => {
    console.log("Received resume document upload for application link:", req.params.link);
    
    try {
      const applicationLink = req.params.link;
      console.log("Looking up job for application link:", applicationLink);
      const job = await storage.getJobByApplicationLink(applicationLink);
      
      if (!job) {
        console.log(`Job not found for application link: ${applicationLink}`);
        return res.status(404).json({ error: "Job not found" });
      }
      
      console.log(`Found job for application link: ${job.id}, ${job.title}, company ID: ${job.companyId}`);
      
      if (!req.file) {
        console.log("No file was uploaded with the request");
        return res.status(400).json({ error: "No document file uploaded" });
      }
      
      console.log(`Resume file received: ${req.file.originalname}, ${req.file.mimetype}, size: ${req.file.size} bytes`);
      
      // Create document record in database
      const documentUrl = `/uploads/documents/${req.file.filename}`;
      console.log(`Document URL: ${documentUrl}`);
      
      console.log("Creating document record in database...");
      try {
        const document = await storage.createDocument({
          name: req.file.originalname,
          type: req.file.mimetype,
          url: documentUrl,
          companyId: job.companyId,
          candidateId: null // Will be linked to candidate later
        });
        
        console.log(`Document record created successfully, ID: ${document.id}`);
        res.status(201).json({ documentId: document.id });
      } catch (dbError) {
        console.error("Database error creating document record:", dbError);
        // More specific error for debugging
        if (dbError instanceof Error) {
          console.error("Error message:", dbError.message);
          console.error("Error stack:", dbError.stack);
        }
        throw dbError;
      }
    } catch (error) {
      console.error("Document upload error:", error);
      res.status(500).json({ 
        error: "Failed to upload document",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  
  // Document upload endpoint for application (new URL format with job ID and shortcode)
  app.post("/api/application/job/:jobId/:shortCode/document", applicationDocumentUpload.single('document'), async (req, res) => {
    console.log("Received resume document upload for job ID and shortcode:", req.params.jobId, req.params.shortCode);
    
    try {
      // Construct application link from jobId and shortCode
      const { jobId, shortCode } = req.params;
      const constructedLink = `${jobId}-${shortCode}`;
      console.log("Constructed application link:", constructedLink);
      
      // Look up the job using the constructed link
      console.log("Looking up job for constructed application link:", constructedLink);
      const job = await storage.getJobByApplicationLink(constructedLink);
      
      if (!job) {
        console.log(`Job not found for constructed application link: ${constructedLink}`);
        return res.status(404).json({ error: "Job not found" });
      }
      
      console.log(`Found job for application link: ${job.id}, ${job.title}, company ID: ${job.companyId}`);
      
      if (!req.file) {
        console.log("No file was uploaded with the request");
        return res.status(400).json({ error: "No document file uploaded" });
      }
      
      console.log(`Resume file received: ${req.file.originalname}, ${req.file.mimetype}, size: ${req.file.size} bytes`);
      
      // Create document record in database
      const documentUrl = `/uploads/documents/${req.file.filename}`;
      console.log(`Document URL: ${documentUrl}`);
      
      console.log("Creating document record in database...");
      try {
        const document = await storage.createDocument({
          name: req.file.originalname,
          type: req.file.mimetype,
          url: documentUrl,
          companyId: job.companyId,
          candidateId: null // Will be linked to candidate later
        });
        
        console.log(`Document record created successfully, ID: ${document.id}`);
        res.status(201).json({ documentId: document.id });
      } catch (dbError) {
        console.error("Database error creating document record:", dbError);
        // More specific error for debugging
        if (dbError instanceof Error) {
          console.error("Error message:", dbError.message);
          console.error("Error stack:", dbError.stack);
        }
        throw dbError;
      }
    } catch (error) {
      console.error("Document upload error:", error);
      res.status(500).json({ 
        error: "Failed to upload document",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Application submission endpoint (legacy URL format)
  app.post("/api/application/:link", async (req, res) => {
    console.log("Received application submission for link:", req.params.link);
    console.log("Request body:", JSON.stringify(req.body));
    
    try {
      const applicationLink = req.params.link;
      const job = await storage.getJobByApplicationLink(applicationLink);
      
      if (!job) {
        console.log(`Job not found for application link: ${applicationLink}`);
        return res.status(404).json({ error: "Job not found" });
      }
      
      console.log(`Found job for application: ${job.id}, ${job.title}, company ID: ${job.companyId}`);
      
      // Extract documentId from request body if present
      const { documentId, ...formData } = req.body;
      console.log(`Document ID from request: ${documentId || 'none'}`);
      
      try {
        // Validate application form data
        const applicationData = applicationFormSchema.parse(formData);
        console.log("Form data validated successfully");
        
        // Create candidate from application data
        console.log("Creating candidate record...");
        const candidate = await storage.createCandidate({
          fullName: applicationData.fullName,
          email: applicationData.email,
          phone: applicationData.phone || null,
          resumeUrl: null, // No longer using resumeUrl
          status: "new",
          notes: applicationData.coverLetter || null,
          companyId: job.companyId,
          jobId: job.id
        });
        
        console.log(`Candidate created successfully with ID: ${candidate.id}`);
        
        // If a document was uploaded, associate it with the candidate
        if (documentId) {
          console.log(`Associating document ID ${documentId} with candidate ID ${candidate.id}`);
          await storage.updateDocument(documentId, {
            candidateId: candidate.id
          });
          
          console.log(`Document association successful`);
        }
        
        // Create notifications for all users in the company about the new application
        try {
          // Get the job title for the notification message
          const jobTitle = job.title;
          
          // Get all users for this company
          const companyUsers = await storage.getUsersByCompany(job.companyId);
          
          console.log(`Creating notifications for ${companyUsers.length} users about new application from ${candidate.fullName}`);
          
          // Create a notification for each user
          for (const user of companyUsers) {
            await storage.createNotification({
              userId: user.id,
              type: "new_candidate",
              title: "New Job Application",
              message: `${candidate.fullName} has applied for the "${jobTitle}" position.`,
              relatedId: candidate.id,
              relatedType: "candidate"
            });
          }
          
          console.log(`Created notifications for ${companyUsers.length} users about new application`);
        } catch (notificationError) {
          // Just log the error but don't fail the request if notifications can't be sent
          console.error("Failed to create notifications for new application:", notificationError);
        }
        
        console.log("Application submission completed successfully");
        res.status(201).json({ message: "Application submitted successfully" });
      } catch (validationError) {
        if (validationError instanceof ZodError) {
          console.error("Validation error:", validationError.errors);
          return res.status(400).json({ error: validationError.errors });
        }
        throw validationError;
      }
    } catch (error) {
      console.error("Application submission error:", error);
      res.status(500).json({ 
        error: "Failed to submit application",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  
  // Application submission endpoint (new URL format with job ID and shortcode)
  app.post("/api/application/job/:jobId/:shortCode", async (req, res) => {
    console.log("Received application submission with job ID and shortcode:", req.params.jobId, req.params.shortCode);
    console.log("Request body:", JSON.stringify(req.body));
    
    try {
      // Construct application link from jobId and shortCode
      const { jobId, shortCode } = req.params;
      const constructedLink = `${jobId}-${shortCode}`;
      console.log("Constructed application link:", constructedLink);
      
      // Look up the job using the constructed link
      console.log("Looking up job for constructed application link:", constructedLink);
      const job = await storage.getJobByApplicationLink(constructedLink);
      
      if (!job) {
        console.log(`Job not found for constructed application link: ${constructedLink}`);
        return res.status(404).json({ error: "Job not found" });
      }
      
      console.log(`Found job for application: ${job.id}, ${job.title}, company ID: ${job.companyId}`);
      
      // Extract documentId from request body if present
      const { documentId, ...formData } = req.body;
      console.log(`Document ID from request: ${documentId || 'none'}`);
      
      try {
        // Validate application form data
        const applicationData = applicationFormSchema.parse(formData);
        console.log("Form data validated successfully");
        
        // Create candidate from application data
        console.log("Creating candidate record...");
        const candidate = await storage.createCandidate({
          fullName: applicationData.fullName,
          email: applicationData.email,
          phone: applicationData.phone || null,
          resumeUrl: null, // No longer using resumeUrl
          status: "new",
          notes: applicationData.coverLetter || null,
          companyId: job.companyId,
          jobId: job.id
        });
        
        console.log(`Candidate created successfully with ID: ${candidate.id}`);
        
        // If a document was uploaded, associate it with the candidate
        if (documentId) {
          console.log(`Associating document ID ${documentId} with candidate ID ${candidate.id}`);
          await storage.updateDocument(documentId, {
            candidateId: candidate.id
          });
          
          console.log(`Document association successful`);
        }
        
        // Create notifications for all users in the company about the new application
        try {
          // Get the job title for the notification message
          const jobTitle = job.title;
          
          // Get all users for this company
          const companyUsers = await storage.getUsersByCompany(job.companyId);
          
          console.log(`Creating notifications for ${companyUsers.length} users about new application from ${candidate.fullName}`);
          
          // Create a notification for each user
          for (const user of companyUsers) {
            await storage.createNotification({
              userId: user.id,
              type: "new_candidate",
              title: "New Job Application",
              message: `${candidate.fullName} has applied for the "${jobTitle}" position.`,
              relatedId: candidate.id,
              relatedType: "candidate"
            });
          }
          
          console.log(`Created notifications for ${companyUsers.length} users about new application`);
        } catch (notificationError) {
          // Just log the error but don't fail the request if notifications can't be sent
          console.error("Failed to create notifications for new application:", notificationError);
        }
        
        console.log("Application submission completed successfully");
        res.status(201).json({ message: "Application submitted successfully" });
      } catch (validationError) {
        if (validationError instanceof ZodError) {
          console.error("Validation error:", validationError.errors);
          return res.status(400).json({ error: validationError.errors });
        }
        throw validationError;
      }
    } catch (error) {
      console.error("Application submission error:", error);
      res.status(500).json({ 
        error: "Failed to submit application",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Candidates API
  app.get("/api/candidates", async (req, res) => {
    const tenantId = req.activeTenantId || req.user!.companyId;
    const candidates = await storage.getCandidatesByCompany(tenantId);
    res.json(candidates);
  });

  // Bulk operations for candidates
  app.post("/api/candidates/bulk", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { action, candidateIds, newStatus } = req.body;
      const tenantId = req.activeTenantId || req.user!.companyId;

      if (!action || !Array.isArray(candidateIds) || candidateIds.length === 0) {
        return res.status(400).json({ error: "Invalid bulk operation request" });
      }

      console.log(`Bulk ${action} operation for ${candidateIds.length} candidates in tenant ${tenantId}`);

      const results = [];
      const errors = [];

      for (const candidateId of candidateIds) {
        try {
          // Verify candidate belongs to tenant before operation
          const candidate = await storage.getCandidateById(candidateId);
          if (!candidate || candidate.companyId !== tenantId) {
            errors.push({ candidateId, error: "Candidate not found or access denied" });
            continue;
          }

          switch (action) {
            case 'delete':
              await storage.deleteCandidate(candidateId);
              results.push({ candidateId, status: 'deleted' });
              break;
            case 'update_status':
              if (!newStatus) {
                errors.push({ candidateId, error: "New status required for update_status action" });
                continue;
              }
              const validStatuses = ["new", "screening", "interview", "offer", "hired", "rejected"];
              if (!validStatuses.includes(newStatus)) {
                errors.push({ candidateId, error: `Invalid status: ${newStatus}` });
                continue;
              }
              await storage.updateCandidate(candidateId, { ...candidate, status: newStatus });
              results.push({ candidateId, status: `updated to ${newStatus}` });
              break;
            case 'archive':
              await storage.updateCandidate(candidateId, { ...candidate, status: 'archived' });
              results.push({ candidateId, status: 'archived' });
              break;
            default:
              errors.push({ candidateId, error: `Unknown action: ${action}` });
          }
        } catch (error) {
          console.error(`Error in bulk operation for candidate ${candidateId}:`, error);
          errors.push({ 
            candidateId, 
            error: error instanceof Error ? error.message : "Unknown error" 
          });
        }
      }

      res.json({
        success: results.length > 0,
        results,
        errors,
        summary: {
          total: candidateIds.length,
          successful: results.length,
          failed: errors.length
        }
      });

    } catch (error) {
      console.error("Bulk candidates operation error:", error);
      res.status(500).json({ error: "Failed to perform bulk operation" });
    }
  });
  
  // Update candidate status endpoint
  app.patch("/api/candidates/:id/status", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const candidateId = parseInt(req.params.id);
      const { status } = req.body;
      
      if (!status) {
        return res.status(400).json({ error: "Status is required" });
      }
      
      // Validate status value
      const validStatuses = ["new", "screening", "interview", "offer", "hired", "rejected"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ 
          error: "Invalid status",
          message: "Status must be one of: new, screening, interview, offer, hired, rejected"
        });
      }
      
      // Get the candidate to verify tenant access
      const candidate = await storage.getCandidateById(candidateId);
      
      if (!candidate) {
        return res.status(404).json({ error: "Candidate not found" });
      }
      
      // Make sure the candidate belongs to the user's company
      const tenantId = req.activeTenantId || req.user!.companyId;
      if (candidate.companyId !== tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Prepare status update
      const updateData = { ...candidate, status };
      
      // Update the candidate
      const updatedCandidate = await storage.updateCandidate(candidateId, updateData);
      
      // If status changed from what it was previously, create a notification
      if (candidate.status !== status) {
        try {
          // Get the job title if available
          let jobTitle = "the position";
          if (candidate.jobId) {
            const job = await storage.getJobById(candidate.jobId);
            if (job) {
              jobTitle = job.title;
            }
          }
          
          // Get all users for this company
          const companyUsers = await storage.getUsersByCompany(tenantId);
          
          // Get company information for emails
          const company = await storage.getCompanyById(tenantId);
          const companyName = company?.name || 'Your Company';
          
          // Create a notification and send email for each user in the company
          for (const user of companyUsers) {
            // Create in-app notification
            await storage.createNotification({
              userId: user.id,
              type: "status_change",
              title: "Candidate Status Updated",
              message: `${candidate.fullName} has been moved to ${status.charAt(0).toUpperCase() + status.slice(1)} stage`,
              relatedId: candidateId,
              relatedType: "candidate"
            });
            
            // Send email notification for status change
            try {
              await emailService.sendStatusChangeNotification(
                user.email,
                user.fullName,
                candidate.fullName,
                status,
                jobTitle,
                companyName
              );
              console.log(`Status change email sent to ${user.email}`);
            } catch (emailError) {
              console.error(`Failed to send status change email to ${user.email}:`, emailError);
            }
          }
        } catch (notificationError) {
          // Just log the error but don't fail the request if notifications can't be sent
          console.error("Failed to create notifications for status change:", notificationError);
        }
      }
      
      res.json(updatedCandidate);
    } catch (error) {
      console.error("Error updating candidate status:", error);
      res.status(500).json({ 
        error: "Failed to update candidate status",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/candidates", async (req, res) => {
    try {
      const tenantId = req.activeTenantId || req.user!.companyId;
      console.log("Creating candidate for tenant ID:", tenantId);
      console.log("Request body:", JSON.stringify(req.body));
      
      // Make sure required fields are present
      if (!req.body.fullName || !req.body.email) {
        console.log("Missing required fields");
        return res.status(400).json({ error: "Full name and email are required" });
      }
      
      // Handle empty strings for optional fields
      const processedData = {
        ...req.body,
        companyId: tenantId,
        phone: req.body.phone || null,
        resumeUrl: req.body.resumeUrl || null,
        notes: req.body.notes || null,
        jobId: req.body.jobId || null,
        status: req.body.status || "new"
      };
      
      console.log("Parsed data:", JSON.stringify(processedData));
      
      try {
        const candidateData = insertCandidateSchema.parse(processedData);
        console.log("Candidate data after validation:", JSON.stringify(candidateData));
        
        const candidate = await storage.createCandidate(candidateData);
        console.log("Candidate created successfully:", JSON.stringify(candidate));
        
        // Send notifications to all company users about the new candidate
        try {
          // Get all users for this company
          const companyUsers = await storage.getUsersByCompany(tenantId);
          
          // Create a notification for each user
          for (const user of companyUsers) {
            await storage.createNotification({
              userId: user.id,
              type: "new_candidate",
              title: "New Candidate Application",
              message: `${candidate.fullName} has applied for ${candidate.jobId ? 'a position' : 'a role'}.`,
              relatedId: candidate.id,
              relatedType: "candidate"
            });
          }
          
          console.log(`Created notifications for ${companyUsers.length} users about new candidate ${candidate.id}`);
        } catch (notificationError) {
          // Just log the error but don't fail the request if notifications can't be sent
          console.error("Failed to create notifications for new candidate:", notificationError);
        }
        
        res.status(201).json(candidate);
      } catch (validationError) {
        console.error("Validation error:", validationError);
        if (validationError instanceof ZodError) {
          return res.status(400).json({ error: validationError.errors });
        }
        throw validationError;
      }
    } catch (error) {
      console.error("Error creating candidate:", error);
      res.status(500).json({ 
        error: "Failed to create candidate", 
        message: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  app.get("/api/candidates/:id", async (req, res) => {
    const candidateId = parseInt(req.params.id);
    const tenantId = req.activeTenantId || req.user!.companyId;
    
    const candidate = await storage.getCandidateById(candidateId);
    
    if (!candidate) {
      return res.status(404).json({ error: "Candidate not found" });
    }
    
    if (candidate.companyId !== tenantId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    res.json(candidate);
  });

  app.put("/api/candidates/:id", async (req, res) => {
    try {
      const candidateId = parseInt(req.params.id);
      const companyId = req.user!.companyId;
      console.log("Updating candidate ID:", candidateId, "for company ID:", companyId);
      console.log("Request body:", JSON.stringify(req.body));
      
      const candidate = await storage.getCandidateById(candidateId);
      
      if (!candidate) {
        return res.status(404).json({ error: "Candidate not found" });
      }
      
      if (candidate.companyId !== companyId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Make sure required fields are present
      if (!req.body.fullName || !req.body.email) {
        console.log("Missing required fields");
        return res.status(400).json({ error: "Full name and email are required" });
      }
      
      // Handle empty strings for optional fields
      const processedData = {
        ...req.body,
        companyId,
        phone: req.body.phone || null,
        resumeUrl: req.body.resumeUrl || null,
        notes: req.body.notes || null,
        jobId: req.body.jobId || null,
        status: req.body.status || candidate.status
      };
      
      console.log("Processed data:", JSON.stringify(processedData));
      
      try {
        const candidateData = insertCandidateSchema.parse(processedData);
        console.log("Candidate data after validation:", JSON.stringify(candidateData));
        
        const updatedCandidate = await storage.updateCandidate(candidateId, candidateData);
        console.log("Candidate updated successfully:", JSON.stringify(updatedCandidate));
        res.json(updatedCandidate);
      } catch (validationError) {
        console.error("Validation error:", validationError);
        if (validationError instanceof ZodError) {
          return res.status(400).json({ error: validationError.errors });
        }
        throw validationError;
      }
    } catch (error) {
      console.error("Error updating candidate:", error);
      res.status(500).json({ 
        error: "Failed to update candidate", 
        message: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  app.delete("/api/candidates/:id", async (req, res) => {
    const candidateId = parseInt(req.params.id);
    const companyId = req.user!.companyId;
    
    const candidate = await storage.getCandidateById(candidateId);
    
    if (!candidate) {
      return res.status(404).json({ error: "Candidate not found" });
    }
    
    if (candidate.companyId !== companyId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    await storage.deleteCandidate(candidateId);
    res.status(204).send();
  });

  // Update candidate status (dedicated endpoint for quick status changes)
  app.patch("/api/candidates/:id/status", async (req, res) => {
    try {
      const candidateId = parseInt(req.params.id);
      const companyId = req.user!.companyId;
      const { status } = req.body;
      
      // Validate status
      const validStatuses = ["new", "screening", "interview", "offer", "hired", "rejected"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      
      // Verify candidate belongs to user's company
      const existingCandidate = await storage.getCandidateById(candidateId);
      if (!existingCandidate || existingCandidate.companyId !== companyId) {
        return res.status(404).json({ error: "Candidate not found" });
      }
      
      // Update only the status
      const updatedCandidate = await storage.updateCandidate(candidateId, { 
        ...existingCandidate,
        status 
      });
      
      // Create notification for status change
      try {
        const job = await storage.getJobById(existingCandidate.jobId);
        const companyUsers = await storage.getUsersByCompany(companyId);
        
        for (const user of companyUsers) {
          await storage.createNotification({
            userId: user.id,
            type: "status_change",
            title: "Candidate Status Updated",
            message: `${existingCandidate.fullName}'s status for ${job?.title || 'Unknown Position'} changed to ${status}`,
            relatedId: candidateId,
            relatedType: "candidate"
          });
        }
      } catch (notificationError) {
        console.error("Error creating status change notification:", notificationError);
        // Don't fail the status update if notification fails
      }
      
      res.json(updatedCandidate);
    } catch (error) {
      console.error("Error updating candidate status:", error);
      res.status(500).json({ error: "Failed to update candidate status" });
    }
  });

  // Document routes
  app.post("/api/candidates/:id/documents", async (req, res) => {
    try {
      const candidateId = parseInt(req.params.id);
      const companyId = req.user!.companyId;
      
      // Verify candidate ownership
      const candidate = await storage.getCandidateById(candidateId);
      if (!candidate || candidate.companyId !== companyId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      if (!req.files?.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      const file = req.files.file;
      const objectKey = `candidates/${candidateId}/documents/${Date.now()}-${file.name}`;
      const bucket = storage.storage.bucket(process.env.BUCKET_NAME);
      const blob = bucket.file(objectKey);
      
      // Upload to object storage
      await blob.save(file.data, {
        contentType: file.mimetype,
        metadata: {
          candidateId: candidateId.toString(),
          originalName: file.name
        }
      });

      // Create document record
      const document = await storage.createDocument({
        name: file.name,
        type: file.mimetype,
        url: objectKey,
        companyId,
        candidateId
      });
      
      res.status(201).json(document);
    } catch (error) {
      console.error("Error uploading document:", error);
      res.status(500).json({ error: "Failed to upload document" });
    }
  });

  app.get("/api/candidates/:id/documents", async (req, res) => {
    try {
      const candidateId = parseInt(req.params.id);
      const companyId = req.user!.companyId;
      
      // Verify candidate ownership
      const candidate = await storage.getCandidateById(candidateId);
      if (!candidate || candidate.companyId !== companyId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const documents = await storage.getDocumentsByCandidate(candidateId);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  app.get("/api/candidates/:id/documents/:docId/download", async (req, res) => {
    try {
      const candidateId = parseInt(req.params.id);
      const documentId = parseInt(req.params.docId);
      const companyId = req.user!.companyId;
      
      // Verify candidate ownership
      const candidate = await storage.getCandidateById(candidateId);
      if (!candidate || candidate.companyId !== companyId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const document = await storage.getDocumentById(documentId);
      if (!document || document.candidateId !== candidateId) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      // Get the file URL and read directly from the filesystem
      const filePath = path.join(process.cwd(), 'public', document.url);
      
      res.setHeader('Content-Type', document.type);
      res.setHeader('Content-Disposition', `attachment; filename="${document.name}"`);
      res.sendFile(filePath);
    } catch (error) {
      console.error("Error downloading document:", error);
      res.status(500).json({ error: "Failed to download document" });
    }
  });

  app.delete("/api/candidates/:id/documents/:docId", async (req, res) => {
    try {
      const candidateId = parseInt(req.params.id);
      const documentId = parseInt(req.params.docId);
      const companyId = req.user!.companyId;
      
      // Verify candidate ownership
      const candidate = await storage.getCandidateById(candidateId);
      if (!candidate || candidate.companyId !== companyId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const document = await storage.getDocumentById(documentId);
      if (!document || document.candidateId !== candidateId) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      // Delete the file from the filesystem
      try {
        const filePath = path.join(process.cwd(), 'public', document.url);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`Deleted document file: ${filePath}`);
        }
      } catch (fileError) {
        console.error(`Error deleting document file: ${fileError}`);
        // Continue even if file deletion fails
      }
      
      // Delete database record
      await storage.deleteDocument(documentId);
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting document:", error);
      res.status(500).json({ error: "Failed to delete document" });
    }
  });

  // Update document name (edit document)
  app.put("/api/documents/:id", async (req, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const companyId = req.user!.companyId;
      const { name } = req.body;
      
      if (!name || name.trim() === "") {
        return res.status(400).json({ error: "Document name is required" });
      }
      
      // Get document and verify ownership through candidate
      const document = await storage.getDocumentById(documentId);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      if (document.candidateId) {
        const candidate = await storage.getCandidateById(document.candidateId);
        if (!candidate || candidate.companyId !== companyId) {
          return res.status(403).json({ error: "Access denied" });
        }
      } else if (document.companyId !== companyId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Update document name
      const updatedDocument = await storage.updateDocument(documentId, { name: name.trim() });
      res.json(updatedDocument);
    } catch (error) {
      console.error("Error updating document:", error);
      res.status(500).json({ error: "Failed to update document" });
    }
  });

  // Delete document
  app.delete("/api/documents/:id", async (req, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const companyId = req.user!.companyId;
      
      // Get document and verify ownership through candidate
      const document = await storage.getDocumentById(documentId);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      if (document.candidateId) {
        const candidate = await storage.getCandidateById(document.candidateId);
        if (!candidate || candidate.companyId !== companyId) {
          return res.status(403).json({ error: "Access denied" });
        }
      } else if (document.companyId !== companyId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Delete the file from the filesystem
      try {
        const filePath = path.join(process.cwd(), 'public', document.url);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`Deleted document file: ${filePath}`);
        }
      } catch (fileError) {
        console.error(`Error deleting document file: ${fileError}`);
        // Continue even if file deletion fails
      }
      
      // Delete database record
      await storage.deleteDocument(documentId);
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting document:", error);
      res.status(500).json({ error: "Failed to delete document" });
    }
  });

  // Company API
  app.get("/api/company", async (req, res) => {
    const companyId = req.user!.companyId;
    const company = await storage.getCompanyById(companyId);
    
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }
    
    res.json(company);
  });

  app.put("/api/company", async (req, res) => {
    try {
      const companyId = req.user!.companyId;
      const company = await storage.getCompanyById(companyId);
      
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }
      
      // Update company data
      const updatedCompany = await storage.updateCompany(companyId, req.body);
      res.json(updatedCompany);
    } catch (error) {
      res.status(500).json({ error: "Failed to update company information" });
    }
  });
  
  // Brokerkit integration endpoint
  app.put("/api/company/integration/brokerkit", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const companyId = req.user!.companyId;
      const company = await storage.getCompanyById(companyId);
      
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }
      
      // Validate the API key format
      const { brokerkitApiKey } = brokerkitIntegrationSchema.parse(req.body);
      
      // Update company with the new API key
      const updatedCompany = await storage.updateCompany(companyId, { 
        brokerkitApiKey 
      });
      
      res.json({
        message: "Brokerkit integration updated successfully",
        brokerkitApiKey: updatedCompany.brokerkitApiKey
      });
    } catch (error) {
      console.error("Error updating Brokerkit integration:", error);
      if (error instanceof ZodError) {
        res.status(400).json({ 
          error: "Validation error", 
          details: error.errors 
        });
      } else {
        res.status(500).json({ 
          error: "Failed to update Brokerkit integration",
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  });

  // Company users API
  app.get("/api/company/users", async (req, res) => {
    try {
      // Check if the showAllUsers query parameter is set and user is admin
      const showAllUsers = req.query.showAllUsers === 'true' && req.user?.role === 'admin';
      
      // Use the active tenant ID (set by middleware) instead of user's company ID
      const tenantId = req.activeTenantId || req.user!.companyId;
      
      let users: any[] = [];
      
      if (showAllUsers) {
        console.log('Admin user requesting all users across all tenants');
        // For admins requesting all users, use the storage's pool to query all users
        // This will get users from all tenants/companies
        const result = await storage.pool.query(`
          SELECT 
            id, 
            username, 
            password, 
            full_name as "fullName", 
            company_id as "companyId", 
            role
          FROM users
        `);
        users = result.rows;
      } else {
        console.log(`Fetching users for tenant ID: ${tenantId}`);
        users = await storage.getUsersByCompany(tenantId);
      }
      
      // Don't send password hashes to the client
      const safeUsers = users.map(user => ({
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        companyId: user.companyId
      }));
      
      console.log(`Retrieved ${safeUsers.length} users ${showAllUsers ? 'across all tenants' : `for tenant ID: ${tenantId}`}`);
      res.json(safeUsers);
    } catch (error) {
      console.error("Error fetching company users:", error);
      res.status(500).json({ error: "Failed to fetch company users" });
    }
  });

  // Invite user endpoint
  app.post("/api/company/users", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const companyId = req.user!.companyId;
      console.log(`Inviting new user for company ID: ${companyId}`, JSON.stringify(req.body));

      // Check if username already exists within this tenant/company
      const existingUser = await storage.getUserByUsername(req.body.username, companyId);
      if (existingUser) {
        console.log(`Username ${req.body.username} already exists in company ${companyId}`);
        return res.status(400).json({ 
          error: "User already exists", 
          message: "A user with this email address already exists in your organization."
        });
      }

      // Use provided password or generate a temporary one
      const userPassword = req.body.password || Math.random().toString(36).slice(-8);
      
      // Split fullName into firstName and lastName for database
      const nameParts = req.body.fullName.split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";
      
      // Create the new user
      const user = await storage.createUser({
        username: req.body.username,
        password: await hashPassword(userPassword),
        firstName,
        lastName,
        fullName: req.body.fullName,
        role: req.body.role,
        companyId: companyId
      });

      // Remove password hash before sending response
      const { password, ...safeUser } = user;
      
      // In a real-world scenario, we would send an email with the password
      console.log(`User created with password: ${req.body.password ? 'custom password' : userPassword}`);
      
      res.status(201).json({
        ...safeUser,
        message: "User created successfully. In a production environment, an invitation email would be sent."
      });
    } catch (error) {
      console.error("Error inviting user:", error);
      res.status(500).json({ 
        error: "Failed to invite user",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  
  // Update user endpoint
  app.put("/api/company/users/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const userId = parseInt(req.params.id);
      const adminCompanyId = req.user!.companyId;
      
      // Get the user to be updated
      const userToUpdate = await storage.getUser(userId);
      
      if (!userToUpdate) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Check if user belongs to the same company as the admin
      if (userToUpdate.companyId !== adminCompanyId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Don't allow users to update their own role (only admins can change roles)
      if (userId === req.user!.id && req.body.role && req.body.role !== req.user!.role) {
        return res.status(403).json({ error: "You cannot change your own role" });
      }
      
      console.log(`Updating user ID: ${userId} for company ID: ${adminCompanyId}`, JSON.stringify(req.body));
      
      // Check if username is being changed and if the new username already exists in this tenant
      if (req.body.username && req.body.username !== userToUpdate.username) {
        const existingUser = await storage.getUserByUsername(req.body.username, adminCompanyId);
        if (existingUser && existingUser.id !== userId) {
          return res.status(400).json({ 
            error: "Username already exists", 
            message: "This email address is already in use by another user in your organization."
          });
        }
      }
      
      // Split fullName into firstName and lastName for database
      const nameParts = req.body.fullName.split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";
      
      // Prepare user update data
      const updateData = {
        firstName,
        lastName,
        fullName: req.body.fullName,
        username: req.body.username,
        role: req.body.role
      };
      
      // Update the user
      const updatedUser = await storage.updateUser(userId, updateData);
      
      // Remove password hash before sending response
      const { password, ...safeUser } = updatedUser;
      
      res.json({
        ...safeUser,
        message: "User updated successfully."
      });
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ 
        error: "Failed to update user",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  
  // User profile update endpoint
  app.put("/api/user/profile", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const userId = req.user!.id;
      const companyId = req.user!.companyId;
      console.log(`Updating profile for user ID: ${userId}`, JSON.stringify(req.body));
      
      // Extract user data from request
      const { firstName, lastName, username } = req.body;
      
      // Check if the new username is already taken within this tenant
      if (username && username !== req.user!.username) {
        const existingUser = await storage.getUserByUsername(username, companyId);
        if (existingUser && existingUser.id !== userId) {
          return res.status(400).json({ 
            error: "Username already exists", 
            message: "This email address is already in use by another user in your organization."
          });
        }
      }
      
      // Create fullName from firstName and lastName
      const fullName = `${firstName} ${lastName}`;
      
      // Update the user
      const updatedUser = await storage.updateUser(userId, {
        username,
        firstName,
        lastName,
        fullName
      });
      
      // Remove password hash before sending JSON response
      const { password, ...safeUser } = updatedUser;
      
      // Explicitly set the response header to application/json
      res.setHeader('Content-Type', 'application/json');
      
      // Send JSON response
      res.json({
        ...safeUser,
        message: "Profile updated successfully."
      });
    } catch (error) {
      console.error("Error updating user profile:", error);
      res.status(500).json({ 
        error: "Failed to update profile",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  
  // Password change endpoint
  app.put("/api/user/password", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Current password and new password are required" });
      }

      // Hash the passwords for comparison
      const hashedCurrentPassword = await hashPassword(currentPassword);
      const hashedNewPassword = await hashPassword(newPassword);
      
      const success = await storage.changeUserPassword(req.user!.id, hashedCurrentPassword, hashedNewPassword);
      
      if (success) {
        res.json({ message: "Password changed successfully" });
      } else {
        res.status(400).json({ error: "Failed to change password" });
      }
    } catch (error: any) {
      console.error("Error changing password:", error);
      res.status(400).json({ error: error.message });
    }
  });

  // User invitation endpoint
  app.post("/api/users/invite", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { username, role = 'user' } = req.body;
      
      if (!username) {
        return res.status(400).json({ error: "Email address is required" });
      }

      // Only admin users can invite others
      if (req.user!.role !== 'admin') {
        return res.status(403).json({ error: "Only administrators can invite users" });
      }

      const newUser = await storage.inviteUser(req.user!.companyId, username, role);
      
      // Remove password from response for security
      const { password, ...userResponse } = newUser;
      
      res.json(userResponse);
    } catch (error: any) {
      console.error("Error inviting user:", error);
      res.status(400).json({ error: error.message });
    }
  });

  // Get users in company
  app.get("/api/users", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const users = await storage.getUsersByCompany(req.user!.companyId);
      
      // Remove passwords from response for security
      const safeUsers = users.map(user => {
        const { password, ...safeUser } = user;
        return safeUser;
      });
      
      res.json(safeUsers);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update user role (admin only)
  app.patch("/api/users/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const userId = parseInt(req.params.id);
      const { role, fullName } = req.body;

      // Only admin users can update other users
      if (req.user!.role !== 'admin') {
        return res.status(403).json({ error: "Only administrators can update user roles" });
      }

      const updatedUser = await storage.updateUser(userId, { role, fullName });
      
      // Remove password from response for security
      const { password, ...userResponse } = updatedUser;
      
      res.json(userResponse);
    } catch (error: any) {
      console.error("Error updating user:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete user (admin only)
  app.delete("/api/users/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const userId = parseInt(req.params.id);

      // Only admin users can delete other users
      if (req.user!.role !== 'admin') {
        return res.status(403).json({ error: "Only administrators can delete users" });
      }

      // Prevent self-deletion
      if (userId === req.user!.id) {
        return res.status(400).json({ error: "You cannot delete your own account" });
      }

      const success = await storage.deleteUser(userId, req.user!.companyId);
      
      if (success) {
        res.json({ message: "User deleted successfully" });
      } else {
        res.status(404).json({ error: "User not found" });
      }
    } catch (error: any) {
      console.error("Error deleting user:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Original password change endpoint - keeping for compatibility
  app.put("/api/user/password-original", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const userId = req.user!.id;
      console.log(`Password change request for user ID: ${userId}`);
      
      // Extract password data from request
      const { currentPassword, newPassword } = req.body;
      
      // Get current user to verify password
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Verify current password
      const isPasswordValid = await comparePasswords(currentPassword, user.password);
      
      if (!isPasswordValid) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }
      
      // Hash the new password
      const hashedPassword = await hashPassword(newPassword);
      
      // Update the user's password
      const updatedUser = await storage.updateUser(userId, {
        password: hashedPassword
      });
      
      // Exclude sensitive data from response
      const { password, ...safeUser } = updatedUser;
      
      res.json({
        ...safeUser,
        message: "Password updated successfully."
      });
    } catch (error) {
      console.error("Error updating password:", error);
      res.status(500).json({ 
        error: "Failed to update password",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.delete("/api/company/users/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const userId = parseInt(req.params.id);
      const adminCompanyId = req.user!.companyId;
      const adminId = req.user!.id;
      
      // Don't allow users to delete themselves
      if (userId === adminId) {
        return res.status(403).json({ error: "You cannot delete your own account" });
      }
      
      // Get the user to be deleted
      const userToDelete = await storage.getUser(userId);
      
      if (!userToDelete) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Check if user belongs to the same company as the admin
      if (userToDelete.companyId !== adminCompanyId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      console.log(`Deleting user ID: ${userId} from company ID: ${adminCompanyId}`);
      
      // Delete the user
      await storage.deleteUser(userId);
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ 
        error: "Failed to delete user",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Job Views API
  app.post("/api/job-views", async (req, res) => {
    try {
      // This endpoint is public, no authentication required
      const { jobId, ipAddress, sessionId } = req.body;
      
      if (!jobId || !ipAddress || !sessionId) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      try {
        const jobViewData = insertJobViewSchema.parse({
          jobId: parseInt(jobId),
          ipAddress,
          sessionId
        });
        
        const jobView = await storage.createJobView(jobViewData);
        console.log(`Job view recorded successfully for job ID: ${jobId}`);
        res.status(201).json({ success: true });
      } catch (validationError) {
        if (validationError instanceof ZodError) {
          return res.status(400).json({ error: validationError.errors });
        }
        throw validationError;
      }
    } catch (error) {
      console.error("Error recording job view:", error);
      res.status(500).json({ error: "Failed to record job view" });
    }
  });
  
  app.get("/api/job-views/:jobId", async (req, res) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const jobId = parseInt(req.params.jobId);
      const companyId = req.user!.companyId;
      
      // Verify job belongs to the company
      const job = await storage.getJobById(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      if (job.companyId !== companyId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const jobViews = await storage.getJobViewsByJob(jobId);
      res.json(jobViews);
    } catch (error) {
      console.error("Error fetching job views:", error);
      res.status(500).json({ error: "Failed to fetch job views" });
    }
  });
  
  app.get("/api/job-views/count/company", async (req, res) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const companyId = req.user!.companyId;
      const viewCounts = await storage.getJobViewsCountByCompany(companyId);
      res.json(viewCounts);
    } catch (error) {
      console.error("Error fetching job view counts:", error);
      res.status(500).json({ error: "Failed to fetch job view counts" });
    }
  });
  
  app.get("/api/job-views/total/company", async (req, res) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const companyId = req.user!.companyId;
      const totalViews = await storage.getTotalJobViewsCount(companyId);
      res.json({ count: totalViews });
    } catch (error) {
      console.error("Error fetching total job views:", error);
      res.status(500).json({ error: "Failed to fetch total job views" });
    }
  });

  // Enhanced job views analytics with month-over-month calculations
  app.get("/api/job-views/analytics/company", async (req, res) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const companyId = req.user!.companyId;
      
      // Get current date and calculate date ranges
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      
      // Get job views analytics with date filtering
      const analytics = await storage.getJobViewsAnalytics(companyId, {
        currentMonthStart,
        lastMonthStart,
        lastMonthEnd
      });
      
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching job views analytics:", error);
      res.status(500).json({ error: "Failed to fetch job views analytics" });
    }
  });

  // Notification API routes
  app.get("/api/notifications", async (req, res) => {
    try {
      // Check if user is authenticated
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

  app.get("/api/notifications/unread", async (req, res) => {
    try {
      // Check if user is authenticated
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

  app.post("/api/notifications/:id/mark-read", async (req, res) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const notificationId = parseInt(req.params.id);
      const userId = req.user!.id;
      
      // First verify the notification belongs to this user
      const notification = await storage.getNotificationById(notificationId);
      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }
      
      if (notification.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const updatedNotification = await storage.markNotificationAsRead(notificationId);
      res.json(updatedNotification);
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  app.post("/api/notifications/mark-all-read", async (req, res) => {
    try {
      // Check if user is authenticated
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

  // Dashboard Analytics APIs
  
  // Job views analytics with month-over-month calculations
  app.get("/api/job-views/analytics/company", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const companyId = req.user!.companyId;
      
      // Calculate date ranges for current and last month
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      
      const analytics = await storage.getJobViewsAnalytics(companyId, {
        currentMonthStart,
        lastMonthStart,
        lastMonthEnd
      });
      
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching job views analytics:", error);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });
  
  // Total job views count
  app.get("/api/job-views/total/company", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const companyId = req.user!.companyId;
      const count = await storage.getTotalJobViewsCount(companyId);
      
      res.json({ count });
    } catch (error) {
      console.error("Error fetching total job views:", error);
      res.status(500).json({ error: "Failed to fetch job views count" });
    }
  });
  
  // Job views count breakdown by job
  app.get("/api/job-views/count/company", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const companyId = req.user!.companyId;
      const viewCounts = await storage.getJobViewsCountByCompany(companyId);
      
      res.json(viewCounts);
    } catch (error) {
      console.error("Error fetching job views count:", error);
      res.status(500).json({ error: "Failed to fetch job views breakdown" });
    }
  });

  // Dashboard analytics endpoint
  app.get("/api/dashboard/analytics", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const tenantId = req.activeTenantId || req.user!.companyId;
      
      // Get current date for analytics calculations
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      
      // Get all data needed for analytics
      const [candidates, jobs] = await Promise.all([
        storage.getCandidatesByCompany(tenantId),
        storage.getJobsByCompany(tenantId)
      ]);
      
      // Calculate applications metrics
      const totalApplications = candidates.length;
      const currentMonthApplications = candidates.filter(c => 
        new Date(c.createdAt) >= currentMonthStart
      ).length;
      
      const lastMonthApplications = candidates.filter(c => {
        const createdAt = new Date(c.createdAt);
        return createdAt >= lastMonthStart && createdAt <= lastMonthEnd;
      }).length;
      
      const applicationChange = lastMonthApplications === 0 
        ? (currentMonthApplications > 0 ? 100 : 0)
        : Math.round(((currentMonthApplications - lastMonthApplications) / lastMonthApplications) * 100);
      
      // Calculate job metrics
      const activeJobs = jobs.filter(job => job.status === 'active').length;
      const totalJobs = jobs.length;
      
      // Calculate job views analytics
      let jobViewsAnalytics;
      try {
        jobViewsAnalytics = await storage.getJobViewsAnalytics(tenantId, {
          currentMonthStart,
          lastMonthStart,
          lastMonthEnd
        });
      } catch (error) {
        console.warn("Job views analytics not available:", error);
        jobViewsAnalytics = {
          currentMonthViews: 0,
          lastMonthViews: 0,
          percentageChange: 0
        };
      }
      
      // Calculate candidate status distribution
      const statusDistribution = candidates.reduce((acc, candidate) => {
        acc[candidate.status] = (acc[candidate.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      // Get recent activity
      const recentActivity = candidates
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10)
        .map(candidate => {
          const job = jobs.find(j => j.id === candidate.jobId);
          return {
            id: candidate.id,
            type: 'application' as const,
            message: `${candidate.fullName} applied for ${job?.title || 'a position'}`,
            timestamp: candidate.createdAt,
            candidateName: candidate.fullName,
            jobTitle: job?.title || 'Unknown Position'
          };
        });
      
      const analytics = {
        // Core metrics
        totalApplications,
        applicationChange,
        activeJobs,
        totalJobs,
        
        // Job views metrics
        totalJobViews: jobViewsAnalytics.currentMonthViews,
        jobViewsChange: jobViewsAnalytics.percentageChange,
        
        // Status distribution
        statusDistribution,
        
        // Recent activity
        recentActivity,
        
        // Time-based metrics
        metrics: {
          currentMonthApplications,
          lastMonthApplications,
          currentMonthViews: jobViewsAnalytics.currentMonthViews,
          lastMonthViews: jobViewsAnalytics.lastMonthViews
        }
      };
      
      res.json(analytics);
      
    } catch (error) {
      console.error("Dashboard analytics error:", error);
      res.status(500).json({ error: "Failed to fetch dashboard analytics" });
    }
  });

  // User invitation endpoint
  app.post("/api/users/invite", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Check if user has admin permissions
      const currentUser = await storage.getUser(req.user!.id);
      if (!currentUser || currentUser.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { username, role = 'user' } = req.body;
      const tenantId = req.activeTenantId || req.user!.companyId;

      if (!username) {
        return res.status(400).json({ error: "Username is required" });
      }

      if (!['admin', 'user'].includes(role)) {
        return res.status(400).json({ error: "Invalid role. Must be 'admin' or 'user'" });
      }

      // Check if user already exists in the company
      const existingUser = await storage.getUserByUsername(username, tenantId);
      if (existingUser) {
        return res.status(400).json({ error: "User already exists in this company" });
      }

      // Create the invited user
      const invitedUser = await storage.inviteUser(tenantId, username, role);

      console.log(`User ${username} invited to company ${tenantId} by ${currentUser.username}`);

      res.json({
        success: true,
        message: "User invited successfully",
        user: {
          id: invitedUser.id,
          username: invitedUser.username,
          role: invitedUser.role,
          companyId: invitedUser.companyId
        }
      });

    } catch (error) {
      console.error("Error inviting user:", error);
      res.status(500).json({ error: "Failed to invite user" });
    }
  });

  // Get users in company endpoint
  app.get("/api/users/company", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const tenantId = req.activeTenantId || req.user!.companyId;
      const users = await storage.getUsersByCompany(tenantId);

      // Remove sensitive information
      const safeUsers = users.map(user => ({
        id: user.id,
        username: user.username,
        role: user.role,
        companyId: user.companyId,
        avatarUrl: user.avatarUrl,
        avatarColor: user.avatarColor
      }));

      res.json(safeUsers);

    } catch (error) {
      console.error("Error fetching company users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Remove user from company endpoint
  app.delete("/api/users/:userId", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Check if user has admin permissions
      const currentUser = await storage.getUser(req.user!.id);
      if (!currentUser || currentUser.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const userId = parseInt(req.params.userId);
      const tenantId = req.activeTenantId || req.user!.companyId;

      if (userId === req.user!.id) {
        return res.status(400).json({ error: "Cannot delete your own account" });
      }

      // Verify user belongs to the same company
      const userToDelete = await storage.getUser(userId);
      if (!userToDelete || userToDelete.companyId !== tenantId) {
        return res.status(404).json({ error: "User not found" });
      }

      const success = await storage.deleteUser(userId, tenantId);
      
      if (success) {
        console.log(`User ${userToDelete.username} removed from company ${tenantId} by ${currentUser.username}`);
        res.json({
          success: true,
          message: "User removed successfully"
        });
      } else {
        res.status(500).json({ error: "Failed to remove user" });
      }

    } catch (error) {
      console.error("Error removing user:", error);
      res.status(500).json({ error: "Failed to remove user" });
    }
  });

  // Password change endpoint
  app.post("/api/user/change-password", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { currentPassword, newPassword } = req.body;
      const userId = req.user!.id;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Current password and new password are required" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: "New password must be at least 6 characters long" });
      }

      // Get current user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Verify current password
      const { comparePasswords, hashPassword } = await import('./auth');
      const isCurrentPasswordValid = await comparePasswords(currentPassword, user.password);
      
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }

      // Hash new password
      const hashedNewPassword = await hashPassword(newPassword);

      // Update user password
      await storage.updateUser(userId, { password: hashedNewPassword });

      console.log(`Password updated successfully for user ${userId}`);

      res.json({
        success: true,
        message: "Password updated successfully"
      });

    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  // Global search endpoint
  app.get("/api/search", async (req, res) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const query = req.query.q as string;
      if (!query || query.length < 2) {
        return res.json({ jobs: [], candidates: [] });
      }
      
      // Use active tenant ID (set by middleware) or fall back to user's primary company
      const tenantId = req.activeTenantId || req.user!.companyId;
      
      console.log(`Searching for "${query}" in tenant ID: ${tenantId}`);
      
      // Search for jobs
      const allJobs = await storage.getJobsByCompany(tenantId);
      const matchedJobs = allJobs.filter(job => {
        const titleMatch = job.title?.toLowerCase().includes(query.toLowerCase());
        const descriptionMatch = job.description?.toLowerCase().includes(query.toLowerCase());
        const locationMatch = job.location?.toLowerCase().includes(query.toLowerCase());
        return titleMatch || descriptionMatch || locationMatch;
      });
      
      // Search for candidates
      const allCandidates = await storage.getCandidatesByCompany(tenantId);
      const matchedCandidates = allCandidates.filter(candidate => {
        const nameMatch = candidate.fullName?.toLowerCase().includes(query.toLowerCase());
        const emailMatch = candidate.email?.toLowerCase().includes(query.toLowerCase());
        const notesMatch = candidate.notes?.toLowerCase().includes(query.toLowerCase());
        const statusMatch = candidate.status?.toLowerCase().includes(query.toLowerCase());
        return nameMatch || emailMatch || notesMatch || statusMatch;
      });
      
      // Enhanced search results with ranking and highlighting
      const enhancedJobs = matchedJobs.map(job => {
        let score = 0;
        const titleMatch = job.title?.toLowerCase().includes(query.toLowerCase());
        const descriptionMatch = job.description?.toLowerCase().includes(query.toLowerCase());
        
        // Calculate relevance score
        if (job.title?.toLowerCase() === query.toLowerCase()) score += 100;
        else if (titleMatch) score += 50;
        if (descriptionMatch) score += 20;
        if (job.status === 'active') score += 10;
        
        return {
          ...job,
          score,
          highlights: {
            title: highlightSearchTerm(job.title, query),
            description: highlightSearchTerm(job.description?.substring(0, 200) || '', query)
          }
        };
      }).sort((a, b) => b.score - a.score);

      const enhancedCandidates = matchedCandidates.map(candidate => {
        let score = 0;
        const nameMatch = candidate.fullName?.toLowerCase().includes(query.toLowerCase());
        const emailMatch = candidate.email?.toLowerCase().includes(query.toLowerCase());
        
        // Calculate relevance score
        if (candidate.fullName?.toLowerCase() === query.toLowerCase()) score += 100;
        else if (nameMatch) score += 60;
        if (emailMatch) score += 30;
        
        return {
          ...candidate,
          score,
          highlights: {
            fullName: highlightSearchTerm(candidate.fullName, query),
            email: highlightSearchTerm(candidate.email, query)
          }
        };
      }).sort((a, b) => b.score - a.score);

      // Return enhanced results with pagination support
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = parseInt(req.query.offset as string) || 0;
      
      res.json({
        jobs: enhancedJobs.slice(offset, offset + limit),
        candidates: enhancedCandidates.slice(offset, offset + limit),
        total: {
          jobs: enhancedJobs.length,
          candidates: enhancedCandidates.length
        },
        hasMore: {
          jobs: offset + limit < enhancedJobs.length,
          candidates: offset + limit < enhancedCandidates.length
        },
        query,
        pagination: { limit, offset }
      });
    } catch (error) {
      console.error("Error performing search:", error);
      res.status(500).json({ error: "Failed to perform search" });
    }
  });

  // Location API Routes
  app.get("/api/locations", tenantSecurityMiddleware, async (req, res) => {
    try {
      const companyId = req.user!.companyId;
      const locations = await storage.getLocationsByCompany(companyId);
      res.json(locations);
    } catch (error) {
      console.error("Error fetching locations:", error);
      res.status(500).json({ error: "Failed to fetch locations" });
    }
  });

  app.get("/api/locations/:id", tenantSecurityMiddleware, async (req, res) => {
    try {
      const locationId = parseInt(req.params.id);
      const companyId = req.user!.companyId;
      
      const location = await storage.getLocationById(locationId);
      
      if (!location) {
        return res.status(404).json({ error: "Location not found" });
      }
      
      if (location.companyId !== companyId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      res.json(location);
    } catch (error) {
      console.error("Error fetching location:", error);
      res.status(500).json({ error: "Failed to fetch location" });
    }
  });

  app.post("/api/locations", tenantSecurityMiddleware, async (req, res) => {
    try {
      const companyId = req.user!.companyId;
      
      // Ensure companyId is correctly set in the location data
      const locationData = {
        ...req.body,
        companyId
      };
      
      try {
        // Parse the request with zod schema
        const validatedLocationData = insertLocationSchema.parse(locationData);
        
        // Create the location
        const location = await storage.createLocation(validatedLocationData);
        return res.status(201).json(location);
      } catch (validationError) {
        if (validationError instanceof ZodError) {
          return res.status(400).json({ 
            error: "Validation error", 
            details: validationError.errors 
          });
        }
        throw validationError; // rethrow if it's not a ZodError
      }
    } catch (error) {
      console.error("Location creation error:", error);
      return res.status(500).json({ 
        error: "Failed to create location", 
        message: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  app.put("/api/locations/:id", tenantSecurityMiddleware, async (req, res) => {
    try {
      const locationId = parseInt(req.params.id);
      const companyId = req.user!.companyId;
      
      // Find location and verify ownership
      const location = await storage.getLocationById(locationId);
      
      if (!location) {
        return res.status(404).json({ error: "Location not found" });
      }
      
      if (location.companyId !== companyId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      try {
        // Include companyId in the update to ensure it doesn't change
        const locationData = {
          ...req.body,
          companyId
        };
        
        // Validate the location data
        const validatedLocationData = insertLocationSchema.parse(locationData);
        
        // Update the location
        const updatedLocation = await storage.updateLocation(locationId, validatedLocationData);
        res.json(updatedLocation);
      } catch (validationError) {
        if (validationError instanceof ZodError) {
          return res.status(400).json({ 
            error: "Validation error", 
            details: validationError.errors 
          });
        }
        throw validationError; // rethrow if it's not a ZodError
      }
    } catch (error) {
      console.error("Location update error:", error);
      res.status(500).json({ error: "Failed to update location" });
    }
  });

  app.delete("/api/locations/:id", tenantSecurityMiddleware, async (req, res) => {
    try {
      const locationId = parseInt(req.params.id);
      const companyId = req.user!.companyId;
      
      // Find location and verify ownership
      const location = await storage.getLocationById(locationId);
      
      if (!location) {
        return res.status(404).json({ error: "Location not found" });
      }
      
      if (location.companyId !== companyId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Delete the location
      await storage.deleteLocation(locationId);
      res.status(204).send();
    } catch (error) {
      console.error("Location deletion error:", error);
      res.status(500).json({ error: "Failed to delete location" });
    }
  });

  // Job Views Analytics API endpoints
  app.get("/api/job-views/analytics", tenantSecurityMiddleware, async (req, res) => {
    try {
      const companyId = req.user!.companyId;
      
      // Calculate date ranges for analytics
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      
      const analytics = await storage.getJobViewsAnalytics(companyId, {
        currentMonthStart,
        lastMonthStart,
        lastMonthEnd
      });
      
      res.json(analytics);
    } catch (error) {
      console.error("Job views analytics error:", error);
      res.status(500).json({ error: "Failed to fetch job views analytics" });
    }
  });

  app.get("/api/job-views/count/company", tenantSecurityMiddleware, async (req, res) => {
    try {
      const companyId = req.user!.companyId;
      const jobViewsCount = await storage.getJobViewsCountByCompany(companyId);
      res.json(jobViewsCount);
    } catch (error) {
      console.error("Job views count error:", error);
      res.status(500).json({ error: "Failed to fetch job views count" });
    }
  });

  app.post("/api/job-views", async (req, res) => {
    try {
      const { jobId, ipAddress, userAgent, referrer } = req.body;
      
      // Get job to find company ID
      const job = await storage.getJobById(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      const jobView = await storage.createJobView({
        jobId,
        companyId: job.companyId,
        ipAddress: ipAddress || req.ip,
        userAgent: userAgent || req.get('User-Agent'),
        referrer: referrer || req.get('Referer')
      });
      
      res.json(jobView);
    } catch (error) {
      console.error("Job view creation error:", error);
      res.status(500).json({ error: "Failed to create job view" });
    }
  });

  // Global Search API - Enhanced search across jobs and candidates
  app.get("/api/search", tenantSecurityMiddleware, async (req, res) => {
    try {
      const companyId = req.user!.companyId;
      const { q: query, type, limit = 10 } = req.query;
      
      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return res.json({ jobs: [], candidates: [] });
      }
      
      const searchTerm = query.trim().toLowerCase();
      const maxResults = Math.min(parseInt(limit as string) || 10, 50);
      
      let jobs = [];
      let candidates = [];
      
      // Search jobs if type is 'all' or 'jobs'
      if (!type || type === 'all' || type === 'jobs') {
        const allJobs = await storage.getJobsByCompany(companyId);
        jobs = allJobs
          .filter(job => 
            job.title.toLowerCase().includes(searchTerm) ||
            job.department.toLowerCase().includes(searchTerm) ||
            job.description?.toLowerCase().includes(searchTerm) ||
            job.status.toLowerCase().includes(searchTerm) ||
            job.type.toLowerCase().includes(searchTerm)
          )
          .slice(0, maxResults);
      }
      
      // Search candidates if type is 'all' or 'candidates'
      if (!type || type === 'all' || type === 'candidates') {
        const allCandidates = await storage.getCandidatesByCompany(companyId);
        candidates = allCandidates
          .filter(candidate => 
            candidate.fullName.toLowerCase().includes(searchTerm) ||
            candidate.email.toLowerCase().includes(searchTerm) ||
            candidate.status.toLowerCase().includes(searchTerm) ||
            candidate.skills?.toLowerCase().includes(searchTerm) ||
            candidate.experience?.toLowerCase().includes(searchTerm)
          )
          .slice(0, maxResults);
      }
      
      res.json({
        jobs,
        candidates,
        totalResults: jobs.length + candidates.length
      });
    } catch (error) {
      console.error("Global search error:", error);
      res.status(500).json({ error: "Failed to perform search" });
    }
  });

  // Application Form Analytics API endpoints
  app.post("/api/application-analytics", async (req, res) => {
    try {
      const { jobId, sessionId, ipAddress, userAgent, referrer, deviceType, browserName } = req.body;
      
      // Get job to find company ID
      const job = await storage.getJobById(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      const analytics = await storage.createApplicationFormAnalytics({
        jobId,
        companyId: job.companyId,
        sessionId,
        ipAddress: ipAddress || req.ip,
        userAgent: userAgent || req.get('User-Agent'),
        referrer: referrer || req.get('Referer'),
        deviceType,
        browserName,
        formStarted: true
      });
      
      res.json(analytics);
    } catch (error) {
      console.error("Application analytics creation error:", error);
      res.status(500).json({ error: "Failed to create application analytics" });
    }
  });

  app.patch("/api/application-analytics/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const updates = req.body;
      
      const analytics = await storage.updateApplicationFormAnalytics(sessionId, updates);
      res.json(analytics);
    } catch (error) {
      console.error("Application analytics update error:", error);
      res.status(500).json({ error: "Failed to update application analytics" });
    }
  });

  app.get("/api/application-analytics/conversion-rates", tenantSecurityMiddleware, async (req, res) => {
    try {
      const companyId = req.user!.companyId;
      const { startDate, endDate } = req.query;
      
      let dateRange;
      if (startDate && endDate) {
        dateRange = {
          startDate: new Date(startDate as string),
          endDate: new Date(endDate as string)
        };
      }
      
      const conversionRates = await storage.getConversionRatesByCompany(companyId, dateRange);
      res.json(conversionRates);
    } catch (error) {
      console.error("Conversion rates error:", error);
      res.status(500).json({ error: "Failed to fetch conversion rates" });
    }
  });

  app.get("/api/application-analytics/job/:jobId", tenantSecurityMiddleware, async (req, res) => {
    try {
      const companyId = req.user!.companyId;
      const jobId = parseInt(req.params.jobId);
      
      // Verify job belongs to company
      const job = await storage.getJobById(jobId);
      if (!job || job.companyId !== companyId) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      const analytics = await storage.getApplicationFormAnalyticsByJob(jobId);
      res.json(analytics);
    } catch (error) {
      console.error("Job analytics error:", error);
      res.status(500).json({ error: "Failed to fetch job analytics" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
