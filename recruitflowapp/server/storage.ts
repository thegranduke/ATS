import {
  type User,
  type InsertUser,
  type Company,
  type InsertCompany,
  type Job,
  type InsertJob,
  type Candidate,
  type InsertCandidate,
  type JobView,
  type InsertJobView,
  type Notification,
  type InsertNotification,
  type Document,
  type InsertDocument,
  type Comment,
  type InsertComment,
  type Location,
  type InsertLocation,
  type SupportTicket,
  type InsertSupportTicket,
  type ApplicationFormAnalytics,
  type InsertApplicationFormAnalytics,
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import pg from "pg";
import { Storage } from "@google-cloud/storage";

// Create memory store for sessions
const MemoryStore = createMemoryStore(session);

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(
    username: string,
    companyId?: number,
  ): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUsersByCompany(companyId: number): Promise<User[]>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User>;
  deleteUser(id: number): Promise<void>;

  // Company operations
  getCompanyById(id: number): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: number, company: Partial<InsertCompany>): Promise<Company>;

  // Job operations
  getJobsByCompany(companyId: number): Promise<Job[]>;
  getJobById(id: number): Promise<Job | undefined>;
  getJobByApplicationLink(link: string): Promise<Job | undefined>;
  createJob(job: InsertJob & { applicationLink: string }): Promise<Job>;
  updateJob(id: number, job: InsertJob): Promise<Job>;
  deleteJob(id: number): Promise<void>;

  // Job View operations
  createJobView(jobView: InsertJobView): Promise<JobView>;
  getJobViewsByJob(jobId: number): Promise<JobView[]>;
  getJobViewsCountByCompany(
    companyId: number,
  ): Promise<{ jobId: number; count: number }[]>;
  getTotalJobViewsCount(companyId: number): Promise<number>;
  getJobViewsAnalytics(
    companyId: number,
    dateRanges: {
      currentMonthStart: Date;
      lastMonthStart: Date;
      lastMonthEnd: Date;
    },
  ): Promise<{
    totalViews: number;
    currentMonthViews: number;
    lastMonthViews: number;
    percentageChange: number;
    trend: "up" | "down" | "same";
  }>;

  // Candidate operations
  getCandidatesByCompany(companyId: number): Promise<Candidate[]>;
  getCandidateById(id: number): Promise<Candidate | undefined>;
  getCandidatesByJob(jobId: number): Promise<Candidate[]>;
  createCandidate(candidate: Omit<Candidate, "id" | "createdAt" | "updatedAt">): Promise<Candidate>;
  updateCandidate(id: number, candidate: InsertCandidate): Promise<Candidate>;
  deleteCandidate(id: number): Promise<void>;

  // Notification operations
  getNotificationsByUser(userId: number): Promise<Notification[]>;
  getUnreadNotificationsByUser(userId: number): Promise<Notification[]>;
  getNotificationById(id: number): Promise<Notification | undefined>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: number): Promise<Notification>;
  markAllNotificationsAsRead(userId: number): Promise<void>;
  deleteNotification(id: number): Promise<void>;

  // Document operations
  getDocumentById(id: number): Promise<Document | undefined>;
  getDocumentsByCandidate(candidateId: number): Promise<Document[]>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(
    id: number,
    document: Partial<InsertDocument>,
  ): Promise<Document>;
  deleteDocument(id: number): Promise<void>;

  // Comment operations
  getCommentsByCandidate(candidateId: number): Promise<Comment[]>;
  createComment(comment: InsertComment): Promise<Comment>;
  updateComment(id: number, comment: Partial<InsertComment>): Promise<Comment>;
  deleteComment(id: number): Promise<void>;

  // Location operations
  getLocationsByCompany(companyId: number): Promise<Location[]>;
  getLocationById(id: number): Promise<Location | undefined>;
  createLocation(location: InsertLocation): Promise<Location>;
  updateLocation(
    id: number,
    location: Partial<InsertLocation>,
  ): Promise<Location>;
  deleteLocation(id: number): Promise<void>;
  getJobsByLocation(locationId: number): Promise<Job[]>;

  // Notification operations
  getNotificationsByUser(userId: number): Promise<Notification[]>;
  getUnreadNotificationsByUser(userId: number): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: number): Promise<void>;
  markAllNotificationsAsRead(userId: number): Promise<void>;

  // Support ticket operations
  getSupportTicketsByUser(userId: number): Promise<SupportTicket[]>;
  getSupportTicketsByCompany(companyId: number): Promise<SupportTicket[]>;
  createSupportTicket(ticket: InsertSupportTicket): Promise<SupportTicket>;
  updateSupportTicket(
    id: number,
    ticket: Partial<InsertSupportTicket>,
  ): Promise<SupportTicket>;

  // Application Form Analytics operations
  createApplicationFormAnalytics(
    analytics: InsertApplicationFormAnalytics,
  ): Promise<ApplicationFormAnalytics>;
  updateApplicationFormAnalytics(
    sessionId: string,
    updates: Partial<InsertApplicationFormAnalytics>,
  ): Promise<ApplicationFormAnalytics>;
  getApplicationFormAnalyticsByJob(
    jobId: number,
  ): Promise<ApplicationFormAnalytics[]>;
  getApplicationFormAnalyticsByCompany(
    companyId: number,
  ): Promise<ApplicationFormAnalytics[]>;
  getConversionRatesByCompany(
    companyId: number,
    dateRange?: { startDate: Date; endDate: Date },
  ): Promise<{
    totalStarted: number;
    totalCompleted: number;
    totalConverted: number;
    conversionRate: number;
    completionRate: number;
    avgTimeToComplete: number;
    topSources: Array<{ source: string; conversions: number; rate: number }>;
    deviceBreakdown: Array<{
      device: string;
      count: number;
      percentage: number;
    }>;
    abandonmentAnalysis: Array<{
      step: number;
      count: number;
      percentage: number;
    }>;
  }>;

  // Brokerkit Integration operations
  getBrokerkitIntegrationsByCompany(companyId: number): Promise<any[]>;
  getBrokerkitIntegrationByCompany(companyId: number): Promise<any | undefined>;
  createBrokerkitIntegration(integration: any): Promise<any>;
  updateBrokerkitIntegration(id: number, integration: any): Promise<any>;
  deleteBrokerkitIntegration(id: number): Promise<void>;

  // Session store
  sessionStore: session.Store;
}

// In-memory storage implementation
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private companies: Map<number, Company>;
  private jobs: Map<number, Job>;
  private candidates: Map<number, Candidate>;

  sessionStore: session.Store;

  userIdCounter: number;
  companyIdCounter: number;
  jobIdCounter: number;
  candidateIdCounter: number;

  constructor() {
    this.users = new Map();
    this.companies = new Map();
    this.jobs = new Map();
    this.candidates = new Map();

    this.userIdCounter = 1;
    this.companyIdCounter = 1;
    this.jobIdCounter = 1;
    this.candidateIdCounter = 1;

    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // 24 hours
    });
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(
    username: string,
    companyId?: number,
  ): Promise<User | undefined> {
    if (companyId !== undefined) {
      return Array.from(this.users.values()).find(
        (user) => user.username === username && user.companyId === companyId,
      );
    } else {
      return Array.from(this.users.values()).find(
        (user) => user.username === username,
      );
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const user = {
      ...insertUser,
      id,
      role: insertUser.role || "user",
    } as User;
    this.users.set(id, user);
    return user;
  }

  async getUsersByCompany(companyId: number): Promise<User[]> {
    return Array.from(this.users.values()).filter(
      (user) => user.companyId === companyId,
    );
  }

  async updateUser(id: number, userUpdate: Partial<InsertUser>): Promise<User> {
    const existingUser = this.users.get(id);
    if (!existingUser) {
      throw new Error(`User with id ${id} not found`);
    }

    const updatedUser = {
      ...existingUser,
      ...userUpdate,
      // Preserve values that shouldn't be changed if not provided
      role: userUpdate.role || existingUser.role,
      companyId: userUpdate.companyId || existingUser.companyId,
    } as User;

    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: number): Promise<void> {
    this.users.delete(id);
  }

  // Company operations
  async getCompanyById(id: number): Promise<Company | undefined> {
    return this.companies.get(id);
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    const id = this.companyIdCounter++;
    const newCompany = {
      ...company,
      id,
      industry: company.industry || null,
      size: company.size || null,
    } as Company;
    this.companies.set(id, newCompany);
    return newCompany;
  }

  async updateCompany(
    id: number,
    companyUpdate: Partial<InsertCompany>,
  ): Promise<Company> {
    const existingCompany = this.companies.get(id);
    if (!existingCompany) {
      throw new Error(`Company with id ${id} not found`);
    }

    const updatedCompany = { ...existingCompany, ...companyUpdate } as Company;
    this.companies.set(id, updatedCompany);
    return updatedCompany;
  }

  // Job operations
  async getJobsByCompany(companyId: number): Promise<Job[]> {
    return Array.from(this.jobs.values()).filter(
      (job) => job.companyId === companyId,
    );
  }

  async getJobById(id: number): Promise<Job | undefined> {
    return this.jobs.get(id);
  }

  async getJobByApplicationLink(link: string): Promise<Job | undefined> {
    return Array.from(this.jobs.values()).find(
      (job) => job.applicationLink === link,
    );
  }

  async createJob(job: InsertJob & { applicationLink: string }): Promise<Job> {
    const id = this.jobIdCounter++;
    const now = new Date();
    const newJob = {
      ...job,
      id,
      status: job.status || "open",
      createdAt: now,
    } as Job;
    this.jobs.set(id, newJob);
    return newJob;
  }

  async updateJob(id: number, jobUpdate: InsertJob): Promise<Job> {
    const existingJob = this.jobs.get(id);
    if (!existingJob) {
      throw new Error(`Job with id ${id} not found`);
    }

    const updatedJob = {
      ...existingJob,
      ...jobUpdate,
      status: jobUpdate.status || existingJob.status,
    } as Job;
    this.jobs.set(id, updatedJob);
    return updatedJob;
  }

  async deleteJob(id: number): Promise<void> {
    this.jobs.delete(id);
  }

  // Candidate operations
  async getCandidatesByCompany(companyId: number): Promise<Candidate[]> {
    return Array.from(this.candidates.values()).filter(
      (candidate) => candidate.companyId === companyId,
    );
  }

  async getCandidateById(id: number): Promise<Candidate | undefined> {
    return this.candidates.get(id);
  }

  async getCandidatesByJob(jobId: number): Promise<Candidate[]> {
    return Array.from(this.candidates.values()).filter(
      (candidate) => candidate.jobId === jobId,
    );
  }

  async createCandidate(candidate: Omit<Candidate, "id" | "createdAt" | "updatedAt">): Promise<Candidate> {
    // Split fullName into firstName and lastName for database insertion
    const nameParts = candidate.fullName.split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ");

    const result = await this.pool.query(
      `
      INSERT INTO candidates (
        full_name, first_name, last_name, email, phone, resume_url, job_id, company_id, status, notes,
        is_licensed, wants_license, agreed_to_marketing
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
      RETURNING 
        id,
        full_name as "fullName",
        first_name as "firstName",
        last_name as "lastName",
        email,
        phone,
        resume_url as "resumeUrl",
        job_id as "jobId",
        company_id as "companyId",
        status,
        notes,
        is_licensed as "isLicensed",
        wants_license as "wantsLicense",
        agreed_to_marketing as "agreedToMarketing",
        created_at as "createdAt"
      `,
      [
        candidate.fullName,
        firstName,
        lastName,
        candidate.email,
        candidate.phone,
        candidate.resumeUrl,
        candidate.jobId,
        candidate.companyId,
        candidate.status,
        candidate.notes,
        candidate.isLicensed ?? false,
        candidate.wantsLicense ?? false,
        candidate.agreedToMarketing ?? false,
      ],
    );
    return result.rows[0];
  }

  async updateCandidate(
    id: number,
    candidateUpdate: InsertCandidate,
  ): Promise<Candidate> {
    const existingCandidate = this.candidates.get(id);
    if (!existingCandidate) {
      throw new Error(`Candidate with id ${id} not found`);
    }

    const updatedCandidate = {
      ...existingCandidate,
      ...candidateUpdate,
      status: candidateUpdate.status || existingCandidate.status,
      phone:
        candidateUpdate.phone !== undefined
          ? candidateUpdate.phone
          : existingCandidate.phone,
      resumeUrl:
        candidateUpdate.resumeUrl !== undefined
          ? candidateUpdate.resumeUrl
          : existingCandidate.resumeUrl,
      notes:
        candidateUpdate.notes !== undefined
          ? candidateUpdate.notes
          : existingCandidate.notes,
      jobId:
        candidateUpdate.jobId !== undefined
          ? candidateUpdate.jobId
          : existingCandidate.jobId,
    } as Candidate;
    this.candidates.set(id, updatedCandidate);
    return updatedCandidate;
  }

  async deleteCandidate(id: number): Promise<void> {
    this.candidates.delete(id);
  }

  // Job View operations
  private jobViews: Map<number, JobView> = new Map();
  private jobViewIdCounter = 1;

  async createJobView(jobView: InsertJobView): Promise<JobView> {
    const id = this.jobViewIdCounter++;
    const now = new Date();
    const newJobView = {
      ...jobView,
      id,
      viewedAt: now,
    } as JobView;
    this.jobViews.set(id, newJobView);
    return newJobView;
  }

  async getJobViewsByJob(jobId: number): Promise<JobView[]> {
    return Array.from(this.jobViews.values()).filter(
      (view) => view.jobId === jobId,
    );
  }

  async getJobViewsCountByCompany(
    companyId: number,
  ): Promise<{ jobId: number; count: number }[]> {
    // Get all jobs for this company
    const companyJobs = await this.getJobsByCompany(companyId);
    const jobIds = companyJobs.map((job) => job.id);

    // Count views for each job
    const counts: { [key: number]: number } = {};
    jobIds.forEach((jobId) => {
      counts[jobId] = 0;
    });

    // Count views for each job
    Array.from(this.jobViews.values()).forEach((view) => {
      if (jobIds.includes(view.jobId)) {
        counts[view.jobId] = (counts[view.jobId] || 0) + 1;
      }
    });

    // Format the result
    return Object.entries(counts).map(([jobId, count]) => ({
      jobId: parseInt(jobId),
      count,
    }));
  }

  async getTotalJobViewsCount(companyId: number): Promise<number> {
    // Get all jobs for this company
    const companyJobs = await this.getJobsByCompany(companyId);
    const jobIds = companyJobs.map((job) => job.id);

    // Count all views for jobs in this company
    return Array.from(this.jobViews.values()).filter((view) =>
      jobIds.includes(view.jobId),
    ).length;
  }

  async getJobViewsAnalytics(
    companyId: number,
    dateRanges: {
      currentMonthStart: Date;
      lastMonthStart: Date;
      lastMonthEnd: Date;
    },
  ): Promise<{
    totalViews: number;
    currentMonthViews: number;
    lastMonthViews: number;
    percentageChange: number;
    trend: "up" | "down" | "same";
  }> {
    // Get all jobs for this company
    const companyJobs = await this.getJobsByCompany(companyId);
    const jobIds = companyJobs.map((job) => job.id);

    let totalViews = 0;
    let currentMonthViews = 0;
    let lastMonthViews = 0;

    Array.from(this.jobViews.values()).forEach((view) => {
      if (jobIds.includes(view.jobId)) {
        totalViews++;

        const viewDate = new Date(view.viewedAt);

        // Check if view is in current month
        if (viewDate >= dateRanges.currentMonthStart) {
          currentMonthViews++;
        }
        // Check if view is in last month
        else if (
          viewDate >= dateRanges.lastMonthStart &&
          viewDate <= dateRanges.lastMonthEnd
        ) {
          lastMonthViews++;
        }
      }
    });

    // Calculate percentage change
    let percentageChange = 0;
    if (lastMonthViews > 0) {
      percentageChange =
        ((currentMonthViews - lastMonthViews) / lastMonthViews) * 100;
    } else if (currentMonthViews > 0) {
      percentageChange = 100; // 100% increase from 0
    }

    // Determine trend
    let trend: "up" | "down" | "same" = "same";
    if (currentMonthViews > lastMonthViews) {
      trend = "up";
    } else if (currentMonthViews < lastMonthViews) {
      trend = "down";
    }

    return {
      totalViews,
      currentMonthViews,
      lastMonthViews,
      percentageChange: Math.round(percentageChange * 100) / 100, // Round to 2 decimal places
      trend,
    };
  }

  // Notification operations
  private notifications: Map<number, Notification> = new Map();
  private notificationIdCounter = 1;

  async getNotificationsByUser(userId: number): Promise<Notification[]> {
    return Array.from(this.notifications.values()).filter(
      (notification) => notification.userId === userId,
    );
  }

  async getUnreadNotificationsByUser(userId: number): Promise<Notification[]> {
    return Array.from(this.notifications.values()).filter(
      (notification) => notification.userId === userId && !notification.read,
    );
  }

  async getNotificationById(id: number): Promise<Notification | undefined> {
    return this.notifications.get(id);
  }

  async createNotification(
    notification: InsertNotification,
  ): Promise<Notification> {
    const id = this.notificationIdCounter++;
    const now = new Date();
    const newNotification = {
      ...notification,
      id,
      read: false,
      createdAt: now,
    } as Notification;
    this.notifications.set(id, newNotification);
    return newNotification;
  }

  async markNotificationAsRead(id: number): Promise<Notification> {
    const notification = this.notifications.get(id);
    if (!notification) {
      throw new Error(`Notification with id ${id} not found`);
    }

    const updatedNotification = {
      ...notification,
      read: true,
    };
    this.notifications.set(id, updatedNotification);
    return updatedNotification;
  }

  async markAllNotificationsAsRead(userId: number): Promise<void> {
    const userNotifications = await this.getNotificationsByUser(userId);
    userNotifications.forEach((notification) => {
      this.notifications.set(notification.id, { ...notification, read: true });
    });
  }

  async deleteNotification(id: number): Promise<void> {
    this.notifications.delete(id);
  }

  // Document operations
  private documents: Map<number, Document> = new Map();
  private documentIdCounter = 1;

  async getDocumentById(id: number): Promise<Document | undefined> {
    return this.documents.get(id);
  }

  async getDocumentsByCandidate(candidateId: number): Promise<Document[]> {
    return Array.from(this.documents.values()).filter(
      (document) => document.candidateId === candidateId,
    );
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    const id = this.documentIdCounter++;
    const now = new Date();
    const newDocument = {
      ...document,
      id,
      uploadedAt: now,
    } as Document;
    this.documents.set(id, newDocument);
    return newDocument;
  }

  async updateDocument(
    id: number,
    documentUpdate: Partial<InsertDocument>,
  ): Promise<Document> {
    const existingDocument = this.documents.get(id);
    if (!existingDocument) {
      throw new Error(`Document with id ${id} not found`);
    }

    const updatedDocument = {
      ...existingDocument,
      ...documentUpdate,
    } as Document;

    this.documents.set(id, updatedDocument);
    return updatedDocument;
  }

  async deleteDocument(id: number): Promise<void> {
    this.documents.delete(id);
  }

  // Comment operations
  private comments: Map<number, Comment> = new Map();
  private commentIdCounter = 1;

  async getCommentsByCandidate(candidateId: number): Promise<Comment[]> {
    return Array.from(this.comments.values()).filter(
      (comment) => comment.candidateId === candidateId,
    );
  }

  async createComment(comment: InsertComment): Promise<Comment> {
    const id = this.commentIdCounter++;
    const now = new Date();
    const newComment = {
      ...comment,
      id,
      createdAt: now,
      updatedAt: now,
    } as Comment;

    this.comments.set(id, newComment);

    // If there are mentioned users, create notifications for them
    if (comment.mentionedUserIds && comment.mentionedUserIds.length > 0) {
      const commentingUser = await this.getUser(comment.userId);
      const candidate = await this.getCandidateById(comment.candidateId);

      if (commentingUser && candidate) {
        for (const mentionedUserId of comment.mentionedUserIds) {
          // Don't notify yourself
          if (mentionedUserId !== comment.userId) {
            await this.createNotification({
              userId: mentionedUserId,
              type: "comment_mention",
              title: "You were mentioned in a comment",
              message: `${commentingUser.fullName} mentioned you in a comment on ${candidate.fullName}'s profile`,
              relatedId: candidate.id,
              relatedType: "candidate",
            });
          }
        }
      }
    }

    return newComment;
  }

  async updateComment(
    id: number,
    commentUpdate: Partial<InsertComment>,
  ): Promise<Comment> {
    const existingComment = this.comments.get(id);
    if (!existingComment) {
      throw new Error(`Comment with id ${id} not found`);
    }

    const oldMentionedUserIds = existingComment.mentionedUserIds || [];

    const updatedComment = {
      ...existingComment,
      ...commentUpdate,
      updatedAt: new Date(),
    } as Comment;

    this.comments.set(id, updatedComment);

    // If there are new mentioned users, create notifications for them
    if (
      commentUpdate.mentionedUserIds &&
      commentUpdate.mentionedUserIds.length > 0
    ) {
      const newMentions = commentUpdate.mentionedUserIds.filter(
        (userId) => !oldMentionedUserIds.includes(userId),
      );

      if (newMentions.length > 0) {
        const commentingUser = await this.getUser(existingComment.userId);
        const candidate = await this.getCandidateById(
          existingComment.candidateId,
        );

        if (commentingUser && candidate) {
          for (const mentionedUserId of newMentions) {
            // Don't notify yourself
            if (mentionedUserId !== existingComment.userId) {
              await this.createNotification({
                userId: mentionedUserId,
                type: "comment_mention",
                title: "You were mentioned in a comment",
                message: `${commentingUser.fullName} mentioned you in a comment on ${candidate.fullName}'s profile`,
                relatedId: candidate.id,
                relatedType: "candidate",
              });
            }
          }
        }
      }
    }

    return updatedComment;
  }

  async deleteComment(id: number): Promise<void> {
    if (!this.comments.has(id)) {
      throw new Error(`Comment with id ${id} not found`);
    }
    this.comments.delete(id);
  }

  // Location operations
  private locations: Map<number, Location> = new Map();
  private locationIdCounter = 1;

  async getLocationsByCompany(companyId: number): Promise<Location[]> {
    return Array.from(this.locations.values()).filter(
      (location) => location.companyId === companyId,
    );
  }

  async getLocationById(id: number): Promise<Location | undefined> {
    return this.locations.get(id);
  }

  async createLocation(location: InsertLocation): Promise<Location> {
    const id = this.locationIdCounter++;
    const now = new Date();
    const newLocation = {
      ...location,
      id,
      createdAt: now,
      updatedAt: now,
    } as Location;

    this.locations.set(id, newLocation);
    return newLocation;
  }

  async updateLocation(
    id: number,
    locationUpdate: Partial<InsertLocation>,
  ): Promise<Location> {
    const existingLocation = this.locations.get(id);
    if (!existingLocation) {
      throw new Error(`Location with id ${id} not found`);
    }

    const updatedLocation = {
      ...existingLocation,
      ...locationUpdate,
      updatedAt: new Date(),
    } as Location;

    this.locations.set(id, updatedLocation);
    return updatedLocation;
  }

  async deleteLocation(id: number): Promise<void> {
    this.locations.delete(id);
  }
}

// Database storage implementation
export class DatabaseStorage implements IStorage {
  pool: pg.Pool; // Changed from private to public so it can be used in routes
  sessionStore: session.Store;
  private storage: any;

  constructor() {
    this.pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
    });

    // Initialize Google Cloud Storage if credentials are available
    if (
      process.env.GOOGLE_CLOUD_STORAGE_BUCKET &&
      process.env.GOOGLE_CLOUD_CREDENTIALS
    ) {
      try {
        this.storage = new Storage({
          projectId: process.env.GOOGLE_CLOUD_PROJECT,
          credentials: JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS),
        });
        console.log("Google Cloud Storage initialized successfully");
      } catch (error) {
        console.log(
          "Google Cloud Storage credentials not found, will use file system storage",
        );
        this.storage = null;
      }
    } else {
      console.log(
        "Google Cloud Storage credentials not found, will use file system storage",
      );
      this.storage = null;
    }

    // Using memory store for sessions for simplicity
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    });

    // Initialize database schema
    this.initializeDatabase().catch(console.error);
  }

  private async initializeDatabase() {
    try {
      const client = await this.pool.connect();
      try {
        // Create users table
        await client.query(`
          CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT NOT NULL,
            email TEXT NOT NULL,
            password TEXT NOT NULL,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            full_name TEXT NOT NULL,
            company_id INTEGER NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            avatar_url TEXT,
            avatar_color TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE (username, company_id)
          );
        `);

        // Create companies table
        await client.query(`
          CREATE TABLE IF NOT EXISTS companies (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            industry TEXT,
            size TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `);

        // Create jobs table
        await client.query(`
          CREATE TABLE IF NOT EXISTS jobs (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            department TEXT NOT NULL,
            location TEXT NOT NULL,
            type TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'open',
            description TEXT NOT NULL,
            application_link TEXT UNIQUE,
            company_id INTEGER NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
          );
        `);

        // Create candidates table
        await client.query(`
          CREATE TABLE IF NOT EXISTS candidates (
            id SERIAL PRIMARY KEY,
            full_name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT,
            resume_url TEXT,
            job_id INTEGER,
            company_id INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'new',
            notes TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
          );
        `);

        // Create job views table
        await client.query(`
          CREATE TABLE IF NOT EXISTS job_views (
            id SERIAL PRIMARY KEY,
            job_id INTEGER NOT NULL,
            ip_address TEXT NOT NULL,
            session_id TEXT NOT NULL,
            viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
          );
        `);

        // Create notifications table
        await client.query(`
          CREATE TABLE IF NOT EXISTS notifications (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            read BOOLEAN NOT NULL DEFAULT FALSE,
            related_id INTEGER,
            related_type TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
          );
        `);

        // Create documents table
        await client.query(`
          CREATE TABLE IF NOT EXISTS documents (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            size INTEGER NOT NULL,
            object_key TEXT NOT NULL,
            candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
            uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
          );
        `);

        // Create comments table
        await client.query(`
          CREATE TABLE IF NOT EXISTS comments (
            id SERIAL PRIMARY KEY,
            content TEXT NOT NULL,
            html_content TEXT NOT NULL,
            candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            mentioned_user_ids INTEGER[],
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
          );
        `);

        // Create notifications table
        await client.query(`
          CREATE TABLE IF NOT EXISTS notifications (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type TEXT NOT NULL CHECK (type IN ('new_candidate', 'new_job', 'status_change', 'comment_mention', 'system')),
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            read BOOLEAN NOT NULL DEFAULT false,
            related_id INTEGER,
            related_type TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
          );
        `);

        // Create support tickets table
        await client.query(`
          CREATE TABLE IF NOT EXISTS support_tickets (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            subject TEXT NOT NULL,
            description TEXT NOT NULL,
            category TEXT NOT NULL,
            priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
            status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
          );
        `);

        console.log("Database initialized successfully");
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Failed to initialize database:", error);
    }
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const result = await this.pool.query(
      `
      SELECT 
        id, 
        username, 
        email,
        password, 
        first_name as "firstName",
        last_name as "lastName",
        full_name as "fullName", 
        company_id as "companyId", 
        role,
        avatar_url as "avatarUrl",
        avatar_color as "avatarColor"
      FROM users WHERE id = $1
    `,
      [id],
    );

    // Log the user we're returning
    if (result.rows[0]) {
      console.log("Fetched user data:", {
        id: result.rows[0].id,
        username: result.rows[0].username,
        fullName: result.rows[0].fullName,
        avatarUrl: result.rows[0].avatarUrl,
        avatarColor: result.rows[0].avatarColor,
      });
    }

    return result.rows[0] || undefined;
  }

  async getUserByUsername(
    username: string,
    companyId?: number,
  ): Promise<User | undefined> {
    let query = `
      SELECT 
        id, 
        username, 
        email,
        password, 
        first_name as "firstName",
        last_name as "lastName",
        full_name as "fullName", 
        company_id as "companyId", 
        role,
        avatar_url as "avatarUrl",
        avatar_color as "avatarColor"
      FROM users WHERE username = $1
    `;

    let params: any[] = [username];

    // If companyId is provided, filter by both username and company
    if (companyId !== undefined) {
      query += ` AND company_id = $2`;
      params.push(companyId);
    }

    const result = await this.pool.query(query, params);
    return result.rows[0] || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const {
      companyId,
      username,
      email,
      password,
      firstName,
      lastName,
      fullName,
      role,
    } = insertUser;
    const result = await this.pool.query(
      `
      INSERT INTO users (company_id, username, email, password, first_name, last_name, full_name, role) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
      RETURNING 
        id, 
        username, 
        email,
        password, 
        first_name as "firstName",
        last_name as "lastName",
        full_name as "fullName", 
        company_id as "companyId", 
        role,
        avatar_url as "avatarUrl",
        avatar_color as "avatarColor"
    `,
      [
        companyId,
        username,
        email,
        password,
        firstName,
        lastName,
        fullName,
        role || "user",
      ],
    );
    return result.rows[0];
  }

  async getUsersByCompany(companyId: number): Promise<User[]> {
    const result = await this.pool.query(
      `
      SELECT 
        id, 
        username, 
        password, 
        full_name as "fullName", 
        company_id as "companyId", 
        role,
        avatar_url as "avatarUrl",
        avatar_color as "avatarColor"
      FROM users 
      WHERE company_id = $1
    `,
      [companyId],
    );
    return result.rows;
  }

  async updateUser(
    id: number,
    userUpdate: Partial<
      InsertUser & { avatarUrl?: string | null; avatarColor?: string | null }
    >,
  ): Promise<User> {
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (userUpdate.username !== undefined) {
      updateFields.push(`username = $${paramIndex++}`);
      values.push(userUpdate.username);
    }

    if (userUpdate.fullName !== undefined) {
      updateFields.push(`full_name = $${paramIndex++}`);
      values.push(userUpdate.fullName);
    }

    if (userUpdate.role !== undefined) {
      updateFields.push(`role = $${paramIndex++}`);
      values.push(userUpdate.role);
    }

    if (userUpdate.password !== undefined) {
      updateFields.push(`password = $${paramIndex++}`);
      values.push(userUpdate.password);
    }

    // Handle avatar fields
    if (userUpdate.avatarUrl !== undefined) {
      updateFields.push(`avatar_url = $${paramIndex++}`);
      values.push(userUpdate.avatarUrl);
    }

    if (userUpdate.avatarColor !== undefined) {
      updateFields.push(`avatar_color = $${paramIndex++}`);
      values.push(userUpdate.avatarColor);
    }

    if (updateFields.length === 0) {
      // No fields to update, just return the current user
      const user = await this.getUser(id);
      if (!user) throw new Error(`User with id ${id} not found`);
      return user;
    }

    values.push(id);
    const result = await this.pool.query(
      `
      UPDATE users 
      SET ${updateFields.join(", ")} 
      WHERE id = $${paramIndex} 
      RETURNING 
        id, 
        username, 
        password, 
        full_name as "fullName", 
        company_id as "companyId", 
        role,
        avatar_url as "avatarUrl",
        avatar_color as "avatarColor"
    `,
      values,
    );

    if (result.rows.length === 0) {
      throw new Error(`User with id ${id} not found`);
    }

    console.log("Updated user with avatar data:", {
      id: result.rows[0].id,
      username: result.rows[0].username,
      avatarUrl: result.rows[0].avatarUrl,
      avatarColor: result.rows[0].avatarColor,
    });

    return result.rows[0];
  }

  async changeUserPassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
  ): Promise<boolean> {
    console.log(`Changing password for user ${userId}`);

    // First verify current password
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Compare current password (assuming passwords are hashed)
    if (user.password !== currentPassword) {
      throw new Error("Current password is incorrect");
    }

    // Update password
    const result = await this.pool.query(
      `
      UPDATE users 
      SET password = $1 
      WHERE id = $2
    `,
      [newPassword, userId],
    );

    console.log(`Password changed successfully for user ${userId}`);
    return result.rowCount > 0;
  }

  async inviteUser(
    companyId: number,
    username: string,
    role: string = "user",
  ): Promise<User> {
    console.log(
      `Inviting user ${username} to company ${companyId} with role ${role}`,
    );

    // Check if user already exists
    const existingUser = await this.getUserByUsername(username);
    if (existingUser) {
      throw new Error("User with this email already exists");
    }

    // Create temporary password (in real implementation, you'd send an email with a reset link)
    const tempPassword = "temp_" + Math.random().toString(36).substring(7);

    const result = await this.pool.query(
      `
      INSERT INTO users (username, password, full_name, company_id, role, avatar_color) 
      VALUES ($1, $2, $3, $4, $5, $6) 
      RETURNING 
        id,
        username,
        password,
        full_name as "fullName",
        company_id as "companyId",
        role,
        avatar_url as "avatarUrl",
        avatar_color as "avatarColor"
    `,
      [
        username,
        tempPassword,
        username.split("@")[0],
        companyId,
        role,
        "#7E57C2",
      ],
    );

    console.log(`User invited successfully:`, result.rows[0]);
    return result.rows[0];
  }

  async getUsersByCompany(companyId: number): Promise<User[]> {
    console.log(`Fetching users for company ${companyId}`);

    const result = await this.pool.query(
      `
      SELECT 
        id,
        username,
        password,
        full_name as "fullName",
        company_id as "companyId",
        role,
        avatar_url as "avatarUrl",
        avatar_color as "avatarColor"
      FROM users 
      WHERE company_id = $1
      ORDER BY full_name ASC
    `,
      [companyId],
    );

    console.log(`Found ${result.rows.length} users for company ${companyId}`);
    return result.rows;
  }

  async deleteUser(id: number, companyId: number): Promise<boolean> {
    console.log(`Deleting user ${id} from company ${companyId}`);

    // Ensure user belongs to the company (security check)
    const result = await this.pool.query(
      `
      DELETE FROM users 
      WHERE id = $1 AND company_id = $2
    `,
      [id, companyId],
    );

    console.log(`User deletion result: ${result.rowCount} rows affected`);
    return result.rowCount > 0;
  }

  // Company operations
  async getCompanyById(id: number): Promise<Company | undefined> {
    const result = await this.pool.query(
      `
      SELECT 
        id, 
        name, 
        industry, 
        size,
        brokerkit_api_key as "brokerkitApiKey",
        logo_url as "logoUrl"
      FROM companies 
      WHERE id = $1
    `,
      [id],
    );
    return result.rows[0] || undefined;
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    const { name, industry, size, brokerkitApiKey, logoUrl } = company;
    const result = await this.pool.query(
      `
      INSERT INTO companies (name, industry, size, brokerkit_api_key, logo_url) 
      VALUES ($1, $2, $3, $4, $5) 
      RETURNING 
        id, 
        name, 
        industry, 
        size,
        brokerkit_api_key as "brokerkitApiKey",
        logo_url as "logoUrl"
    `,
      [name, industry, size, brokerkitApiKey, logoUrl],
    );
    return result.rows[0];
  }

  async updateCompany(
    id: number,
    companyUpdate: Partial<InsertCompany>,
  ): Promise<Company> {
    const { name, industry, size, brokerkitApiKey, logoUrl } = companyUpdate;
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (industry !== undefined) {
      updateFields.push(`industry = $${paramIndex++}`);
      values.push(industry);
    }
    if (size !== undefined) {
      updateFields.push(`size = $${paramIndex++}`);
      values.push(size);
    }
    if (brokerkitApiKey !== undefined) {
      updateFields.push(`brokerkit_api_key = $${paramIndex++}`);
      values.push(brokerkitApiKey);
    }
    if (logoUrl !== undefined) {
      updateFields.push(`logo_url = $${paramIndex++}`);
      values.push(logoUrl);
    }

    if (updateFields.length === 0) {
      // No fields to update, just return the current company
      const company = await this.getCompanyById(id);
      if (!company) throw new Error(`Company with id ${id} not found`);
      return company;
    }

    values.push(id);
    const result = await this.pool.query(
      `
      UPDATE companies 
      SET ${updateFields.join(", ")} 
      WHERE id = $${paramIndex} 
      RETURNING 
        id, 
        name, 
        industry, 
        size,
        brokerkit_api_key as "brokerkitApiKey",
        logo_url as "logoUrl"
    `,
      values,
    );

    if (result.rows.length === 0) {
      throw new Error(`Company with id ${id} not found`);
    }
    return result.rows[0];
  }

  // Job operations
  async getJobsByCompany(companyId: number): Promise<Job[]> {
    const result = await this.pool.query(
      `
      SELECT 
        j.id,
        j.title,
        j.department,
        j.type,
        j.status,
        j.description,
        j.application_link as "applicationLink",
        j.company_id as "companyId",
        j.category,
        j.experience,
        j.salary_start as "salaryStart",
        j.salary_end as "salaryEnd",
        j.payment_type as "paymentType",
        j.currency,
        j.internal_code as "internalCode",
        j.education,
        j.location_id as "locationId",
        j.created_at as "createdAt"
      FROM jobs j
      WHERE j.company_id = $1
    `,
      [companyId],
    );
    return result.rows;
  }

  async getJobById(id: number): Promise<Job | undefined> {
    const result = await this.pool.query(
      `
      SELECT 
        j.id,
        j.title,
        j.department,
        j.type,
        j.status,
        j.description,
        j.application_link as "applicationLink",
        j.company_id as "companyId",
        j.category,
        j.experience,
        j.salary_start as "salaryStart",
        j.salary_end as "salaryEnd",
        j.payment_type as "paymentType",
        j.currency,
        j.internal_code as "internalCode",
        j.education,
        j.location_id as "locationId",
        j.created_at as "createdAt",
        j.enable_phone as "enablePhone",
        j.require_phone as "requirePhone",
        j.enable_address as "enableAddress",
        j.require_address as "requireAddress",
        j.show_license_options as "showLicenseOptions",
        j.license_state_name as "licenseStateName",
        j.require_resume as "requireResume"
      FROM jobs j
      WHERE j.id = $1
    `,
      [id],
    );
    return result.rows[0] || undefined;
  }

  async getJobByApplicationLink(link: string): Promise<Job | undefined> {
    const result = await this.pool.query(
      `
      SELECT 
        j.id,
        j.title,
        j.department,
        j.type,
        j.status,
        j.description,
        j.application_link as "applicationLink",
        j.company_id as "companyId",
        j.category,
        j.experience,
        j.salary_start as "salaryStart",
        j.salary_end as "salaryEnd",
        j.payment_type as "paymentType",
        j.currency,
        j.internal_code as "internalCode",
        j.education,
        j.location_id as "locationId",
        j.created_at as "createdAt",
        j.enable_phone as "enablePhone",
        j.require_phone as "requirePhone",
        j.enable_address as "enableAddress",
        j.require_address as "requireAddress",
        j.show_license_options as "showLicenseOptions",
        j.license_state_name as "licenseStateName",
        j.require_resume as "requireResume"
      FROM jobs j
      WHERE j.application_link = $1
    `,
      [link],
    );
    return result.rows[0] || undefined;
  }

  async createJob(job: InsertJob & { applicationLink: string }): Promise<Job> {
    try {
      console.log(
        "[DIAG] DatabaseStorage: Creating job with data:",
        JSON.stringify(job),
      );

      // Validate job data
      if (!job.title || !job.companyId) {
        console.error(
          "[DIAG] DatabaseStorage: Missing required job properties:",
          {
            hasTitle: !!job.title,
            hasCompanyId: !!job.companyId,
            hasDescription: !!job.description,
            hasLocationId: !!job.locationId,
            hasType: !!job.type,
            hasDepartment: !!job.department,
            hasAppLink: !!job.applicationLink,
          },
        );
        throw new Error("Job validation failed: Missing required properties");
      }

      const {
        title,
        department,
        description,
        locationId,
        type,
        companyId,
        status,
        applicationLink,
        category,
        experience,
        salaryStart,
        salaryEnd,
        paymentType,
        currency,
        internalCode,
        education,
      } = job;

      console.log("[DIAG] DatabaseStorage: Extracted job properties:", {
        title,
        department,
        description,
        locationId,
        type,
        companyId,
        status,
        applicationLink,
      });

      const result = await this.pool.query(
        `
        INSERT INTO jobs (
          title, 
          department, 
          description, 
          type, 
          company_id, 
          status, 
          application_link,
          category,
          experience,
          salary_start,
          salary_end,
          payment_type,
          currency,
          internal_code,
          education,
          location_id,
          enable_phone,
          require_phone,
          enable_address,
          require_address,
          show_license_options,
          license_state_name,
          require_resume
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23) 
        RETURNING 
          id,
          title,
          department,
          type,
          status,
          description,
          application_link as "applicationLink",
          company_id as "companyId",
          category,
          experience,
          salary_start as "salaryStart",
          salary_end as "salaryEnd",
          payment_type as "paymentType",
          currency,
          internal_code as "internalCode",
          education,
          location_id as "locationId",
          created_at as "createdAt",
          enable_phone as "enablePhone",
          require_phone as "requirePhone",
          enable_address as "enableAddress",
          require_address as "requireAddress",
          show_license_options as "showLicenseOptions",
          license_state_name as "licenseStateName",
          require_resume as "requireResume"
      `,
        [
          title,
          department,
          description,
          type,
          companyId,
          status || "active",
          applicationLink,
          category,
          experience,
          salaryStart,
          salaryEnd,
          paymentType,
          currency,
          internalCode,
          education,
          locationId,
          job.enablePhone ?? true,
          job.requirePhone ?? false,
          job.enableAddress ?? true,
          job.requireAddress ?? false,
          job.showLicenseOptions ?? false,
          job.licenseStateName ?? null,
          job.requireResume ?? false,
        ],
      );

      const newJob = result.rows[0];
      console.log(
        "[DIAG] DatabaseStorage: Job created successfully with ID:",
        newJob.id,
      );
      return newJob;
    } catch (error) {
      console.error("[DIAG] DatabaseStorage: Error creating job:", error);
      if (error instanceof Error) {
        console.error("[DIAG] DatabaseStorage: Error details:", {
          message: error.message,
          stack: error.stack,
        });
      }
      throw error;
    }
  }

  async updateJob(id: number, jobUpdate: InsertJob): Promise<Job> {
    console.log(
      "[DIAG] DatabaseStorage: Updating job with data:",
      JSON.stringify(jobUpdate),
    );

    const {
      title,
      department,
      description,
      locationId,
      type,
      companyId,
      status,
      category,
      experience,
      salaryStart,
      salaryEnd,
      paymentType,
      currency,
      internalCode,
      education,
    } = jobUpdate;

    const result = await this.pool.query(
      `
      UPDATE jobs 
      SET 
        title = $1, 
        department = $2, 
        description = $3, 
        type = $4, 
        company_id = $5, 
        status = $6,
        category = $7,
        experience = $8,
        salary_start = $9,
        salary_end = $10,
        payment_type = $11,
        currency = $12,
        internal_code = $13,
        education = $14,
        location_id = $15,
        enable_phone = $16,
        require_phone = $17,
        enable_address = $18,
        require_address = $19,
        show_license_options = $20,
        license_state_name = $21,
        require_resume = $22
      WHERE id = $23
      RETURNING 
        id,
        title,
        department,
        type,
        status,
        description,
        application_link as "applicationLink",
        company_id as "companyId",
        category,
        experience,
        salary_start as "salaryStart",
        salary_end as "salaryEnd",
        payment_type as "paymentType",
        currency,
        internal_code as "internalCode",
        education,
        location_id as "locationId",
        created_at as "createdAt",
        enable_phone as "enablePhone",
        require_phone as "requirePhone",
        enable_address as "enableAddress",
        require_address as "requireAddress",
        show_license_options as "showLicenseOptions",
        license_state_name as "licenseStateName",
        require_resume as "requireResume"
    `,
      [
        title,
        department,
        description,
        type,
        companyId,
        status || "active",
        category,
        experience,
        salaryStart,
        salaryEnd,
        paymentType,
        currency,
        internalCode,
        education,
        locationId,
        jobUpdate.enablePhone ?? true,
        jobUpdate.requirePhone ?? false,
        jobUpdate.enableAddress ?? true,
        jobUpdate.requireAddress ?? false,
        jobUpdate.showLicenseOptions ?? false,
        jobUpdate.licenseStateName ?? null,
        jobUpdate.requireResume ?? false,
        id,
      ],
    );

    if (result.rows.length === 0) {
      throw new Error(`Job with id ${id} not found`);
    }

    // Enrich the response with joined location data if available
    if (result.rows[0].locationId) {
      try {
        const location = await this.getLocationById(result.rows[0].locationId);
        if (location) {
          result.rows[0].locationData = location;
        }
      } catch (err) {
        console.error("[DIAG] Error enriching job with location data:", err);
      }
    }

    console.log(
      "[DIAG] DatabaseStorage: Job updated successfully, returning:",
      JSON.stringify(result.rows[0]),
    );
    return result.rows[0];
  }

  async deleteJob(id: number): Promise<void> {
    const result = await this.pool.query("DELETE FROM jobs WHERE id = $1", [
      id,
    ]);
    if (result.rowCount === 0) {
      throw new Error(`Job with id ${id} not found`);
    }
  }

  // Candidate operations
  async getCandidatesByCompany(companyId: number): Promise<Candidate[]> {
    const result = await this.pool.query(
      `
      SELECT 
        id,
        full_name as "fullName",
        email,
        phone,
        resume_url as "resumeUrl",
        job_id as "jobId",
        company_id as "companyId",
        status,
        notes,
        created_at as "createdAt"
      FROM candidates 
      WHERE company_id = $1
    `,
      [companyId],
    );
    return result.rows;
  }

  async getCandidateById(id: number): Promise<Candidate | undefined> {
    const result = await this.pool.query(
      `
      SELECT 
        id,
        full_name as "fullName",
        email,
        phone,
        resume_url as "resumeUrl",
        job_id as "jobId",
        company_id as "companyId",
        status,
        notes,
        created_at as "createdAt"
      FROM candidates 
      WHERE id = $1
    `,
      [id],
    );
    return result.rows[0] || undefined;
  }

  async getCandidatesByJob(jobId: number): Promise<Candidate[]> {
    const result = await this.pool.query(
      `
      SELECT 
        id,
        full_name as "fullName",
        email,
        phone,
        resume_url as "resumeUrl",
        job_id as "jobId",
        company_id as "companyId",
        status,
        notes,
        created_at as "createdAt"
      FROM candidates 
      WHERE job_id = $1
    `,
      [jobId],
    );
    return result.rows;
  }

  async createCandidate(candidate: Omit<Candidate, "id" | "createdAt" | "updatedAt">): Promise<Candidate> {
    // Split fullName into firstName and lastName for database insertion
    const nameParts = candidate.fullName.split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ");

    const result = await this.pool.query(
      `
      INSERT INTO candidates (
        full_name, first_name, last_name, email, phone, resume_url, job_id, company_id, status, notes,
        is_licensed, wants_license, agreed_to_marketing
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
      RETURNING 
        id,
        full_name as "fullName",
        first_name as "firstName",
        last_name as "lastName",
        email,
        phone,
        resume_url as "resumeUrl",
        job_id as "jobId",
        company_id as "companyId",
        status,
        notes,
        is_licensed as "isLicensed",
        wants_license as "wantsLicense",
        agreed_to_marketing as "agreedToMarketing",
        created_at as "createdAt"
      `,
      [
        candidate.fullName,
        firstName,
        lastName,
        candidate.email,
        candidate.phone,
        candidate.resumeUrl,
        candidate.jobId,
        candidate.companyId,
        candidate.status,
        candidate.notes,
        candidate.isLicensed ?? false,
        candidate.wantsLicense ?? false,
        candidate.agreedToMarketing ?? false,
      ],
    );
    return result.rows[0];
  }

  async updateCandidate(
    id: number,
    candidateUpdate: InsertCandidate,
  ): Promise<Candidate> {
    const {
      fullName,
      email,
      phone,
      resumeUrl,
      jobId,
      companyId,
      status,
      notes,
    } = candidateUpdate;

    // Split fullName into firstName and lastName for database
    const nameParts = fullName.split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ");

    console.log(
      `Updating candidate ${id} '${fullName}', first_name: '${firstName}', last_name: '${lastName}'`,
    );

    const result = await this.pool.query(
      `
      UPDATE candidates 
      SET 
        full_name = $1, 
        first_name = $2,
        last_name = $3,
        email = $4, 
        phone = $5, 
        resume_url = $6, 
        job_id = $7, 
        company_id = $8, 
        status = $9, 
        notes = $10 
      WHERE id = $11 
      RETURNING 
        id,
        full_name as "fullName",
        first_name as "firstName",
        last_name as "lastName",
        email,
        phone,
        resume_url as "resumeUrl",
        job_id as "jobId",
        company_id as "companyId",
        status,
        notes,
        created_at as "createdAt"
    `,
      [
        fullName,
        firstName,
        lastName,
        email,
        phone,
        resumeUrl,
        jobId,
        companyId,
        status || "new",
        notes,
        id,
      ],
    );

    if (result.rows.length === 0) {
      throw new Error(`Candidate with id ${id} not found`);
    }
    return result.rows[0];
  }

  async deleteCandidate(id: number): Promise<void> {
    const result = await this.pool.query(
      "DELETE FROM candidates WHERE id = $1",
      [id],
    );
    if (result.rowCount === 0) {
      throw new Error(`Candidate with id ${id} not found`);
    }
  }

  // Job View operations
  async createJobView(jobView: InsertJobView): Promise<JobView> {
    const { jobId, companyId, ipAddress, userAgent, referrer } = jobView;
    const result = await this.pool.query(
      `
      INSERT INTO job_views (job_id, company_id, ip_address, user_agent, referrer) 
      VALUES ($1, $2, $3, $4, $5) 
      RETURNING 
        id,
        job_id as "jobId",
        company_id as "companyId",
        ip_address as "ipAddress",
        user_agent as "userAgent",
        referrer,
        viewed_at as "viewedAt"
    `,
      [jobId, companyId, ipAddress, userAgent, referrer],
    );
    return result.rows[0];
  }

  async getJobViewsByJob(jobId: number): Promise<JobView[]> {
    const result = await this.pool.query(
      `
      SELECT 
        id,
        job_id as "jobId",
        ip_address as "ipAddress",
        session_id as "sessionId",
        viewed_at as "viewedAt"
      FROM job_views 
      WHERE job_id = $1
    `,
      [jobId],
    );
    return result.rows;
  }

  async getJobViewsCountByCompany(
    companyId: number,
  ): Promise<{ jobId: number; count: number }[]> {
    const result = await this.pool.query(
      `
      SELECT 
        j.id as "jobId",
        COUNT(jv.id) as "count"
      FROM jobs j
      LEFT JOIN job_views jv ON j.id = jv.job_id
      WHERE j.company_id = $1
      GROUP BY j.id
    `,
      [companyId],
    );

    return result.rows.map((row) => ({
      jobId: parseInt(row.jobId),
      count: parseInt(row.count),
    }));
  }

  async getTotalJobViewsCount(companyId: number): Promise<number> {
    const result = await this.pool.query(
      `
      SELECT 
        COUNT(jv.id) as "count"
      FROM job_views jv
      JOIN jobs j ON j.id = jv.job_id
      WHERE j.company_id = $1
    `,
      [companyId],
    );

    return parseInt(result.rows[0]?.count || "0");
  }

  async getJobViewsAnalytics(
    companyId: number,
    dateRanges: {
      currentMonthStart: Date;
      lastMonthStart: Date;
      lastMonthEnd: Date;
    },
  ): Promise<{
    totalViews: number;
    currentMonthViews: number;
    lastMonthViews: number;
    percentageChange: number;
    trend: "up" | "down" | "same";
  }> {
    // Get total views for this company
    const totalResult = await this.pool.query(
      `
      SELECT COUNT(jv.id) as "count"
      FROM job_views jv
      JOIN jobs j ON j.id = jv.job_id
      WHERE j.company_id = $1
    `,
      [companyId],
    );

    // Get current month views
    const currentMonthResult = await this.pool.query(
      `
      SELECT COUNT(jv.id) as "count"
      FROM job_views jv
      JOIN jobs j ON j.id = jv.job_id
      WHERE j.company_id = $1 AND jv.viewed_at >= $2
    `,
      [companyId, dateRanges.currentMonthStart],
    );

    // Get last month views
    const lastMonthResult = await this.pool.query(
      `
      SELECT COUNT(jv.id) as "count"
      FROM job_views jv
      JOIN jobs j ON j.id = jv.job_id
      WHERE j.company_id = $1 
        AND jv.viewed_at >= $2 
        AND jv.viewed_at <= $3
    `,
      [companyId, dateRanges.lastMonthStart, dateRanges.lastMonthEnd],
    );

    const totalViews = parseInt(totalResult.rows[0]?.count || "0");
    const currentMonthViews = parseInt(
      currentMonthResult.rows[0]?.count || "0",
    );
    const lastMonthViews = parseInt(lastMonthResult.rows[0]?.count || "0");

    // Calculate percentage change
    let percentageChange = 0;
    if (lastMonthViews > 0) {
      percentageChange =
        ((currentMonthViews - lastMonthViews) / lastMonthViews) * 100;
    } else if (currentMonthViews > 0) {
      percentageChange = 100; // 100% increase from 0
    }

    // Determine trend
    let trend: "up" | "down" | "same" = "same";
    if (currentMonthViews > lastMonthViews) {
      trend = "up";
    } else if (currentMonthViews < lastMonthViews) {
      trend = "down";
    }

    return {
      totalViews,
      currentMonthViews,
      lastMonthViews,
      percentageChange: Math.round(percentageChange * 100) / 100, // Round to 2 decimal places
      trend,
    };
  }

  // Notification operations
  async getNotificationsByUser(userId: number): Promise<Notification[]> {
    const result = await this.pool.query(
      `
      SELECT 
        id,
        user_id as "userId",
        type,
        title,
        message,
        read,
        related_id as "relatedId",
        related_type as "relatedType",
        created_at as "createdAt"
      FROM notifications 
      WHERE user_id = $1
      ORDER BY created_at DESC
    `,
      [userId],
    );
    return result.rows;
  }

  async getUnreadNotificationsByUser(userId: number): Promise<Notification[]> {
    const result = await this.pool.query(
      `
      SELECT 
        id,
        user_id as "userId",
        type,
        title,
        message,
        read,
        related_id as "relatedId",
        related_type as "relatedType",
        created_at as "createdAt"
      FROM notifications 
      WHERE user_id = $1 AND read = false
      ORDER BY created_at DESC
    `,
      [userId],
    );
    return result.rows;
  }

  async getNotificationById(id: number): Promise<Notification | undefined> {
    const result = await this.pool.query(
      `
      SELECT 
        id,
        user_id as "userId",
        type,
        title,
        message,
        read,
        related_id as "relatedId",
        related_type as "relatedType",
        created_at as "createdAt"
      FROM notifications 
      WHERE id = $1
    `,
      [id],
    );
    return result.rows[0] || undefined;
  }

  async createNotification(
    notification: InsertNotification,
  ): Promise<Notification> {
    const { userId, type, title, message, relatedId, relatedType } =
      notification;
    const result = await this.pool.query(
      `
      INSERT INTO notifications (user_id, type, title, message, related_id, related_type) 
      VALUES ($1, $2, $3, $4, $5, $6) 
      RETURNING 
        id,
        user_id as "userId",
        type,
        title,
        message,
        read,
        related_id as "relatedId",
        related_type as "relatedType",
        created_at as "createdAt"
    `,
      [userId, type, title, message, relatedId, relatedType],
    );
    return result.rows[0];
  }

  async markNotificationAsRead(id: number): Promise<Notification> {
    const result = await this.pool.query(
      `
      UPDATE notifications 
      SET read = true 
      WHERE id = $1 
      RETURNING 
        id,
        user_id as "userId",
        type,
        title,
        message,
        read,
        related_id as "relatedId",
        related_type as "relatedType",
        created_at as "createdAt"
    `,
      [id],
    );

    if (result.rows.length === 0) {
      throw new Error(`Notification with id ${id} not found`);
    }

    return result.rows[0];
  }

  async markAllNotificationsAsRead(userId: number): Promise<void> {
    await this.pool.query(
      `
      UPDATE notifications 
      SET read = true 
      WHERE user_id = $1 AND read = false
    `,
      [userId],
    );
  }

  async deleteNotification(id: number): Promise<void> {
    const result = await this.pool.query(
      "DELETE FROM notifications WHERE id = $1",
      [id],
    );
    if (result.rowCount === 0) {
      throw new Error(`Notification with id ${id} not found`);
    }
  }

  // Document operations
  async getDocumentById(id: number): Promise<Document | undefined> {
    const result = await this.pool.query(
      `
      SELECT 
        id, 
        name,
        type,
        url,
        company_id as "companyId",
        candidate_id as "candidateId",
        created_at as "createdAt"
      FROM documents 
      WHERE id = $1
    `,
      [id],
    );

    return result.rows[0] || undefined;
  }

  async getDocumentsByCandidate(candidateId: number): Promise<Document[]> {
    const result = await this.pool.query(
      `
      SELECT 
        id, 
        name,
        type,
        url,
        company_id as "companyId",
        candidate_id as "candidateId",
        created_at as "createdAt"
      FROM documents 
      WHERE candidate_id = $1
      ORDER BY created_at DESC
    `,
      [candidateId],
    );

    return result.rows;
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    const { name, type, url, companyId, candidateId } = document;

    const result = await this.pool.query(
      `
      INSERT INTO documents (name, type, url, company_id, candidate_id) 
      VALUES ($1, $2, $3, $4, $5) 
      RETURNING 
        id, 
        name,
        type,
        url,
        company_id as "companyId",
        candidate_id as "candidateId",
        created_at as "createdAt"
    `,
      [name, type, url, companyId, candidateId],
    );

    return result.rows[0];
  }

  async updateDocument(
    id: number,
    documentUpdate: Partial<InsertDocument>,
  ): Promise<Document> {
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (documentUpdate.name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`);
      values.push(documentUpdate.name);
    }

    if (documentUpdate.type !== undefined) {
      updateFields.push(`type = $${paramIndex++}`);
      values.push(documentUpdate.type);
    }

    if (documentUpdate.url !== undefined) {
      updateFields.push(`url = $${paramIndex++}`);
      values.push(documentUpdate.url);
    }

    if (documentUpdate.companyId !== undefined) {
      updateFields.push(`company_id = $${paramIndex++}`);
      values.push(documentUpdate.companyId);
    }

    if (documentUpdate.candidateId !== undefined) {
      updateFields.push(`candidate_id = $${paramIndex++}`);
      values.push(documentUpdate.candidateId);
    }

    if (updateFields.length === 0) {
      // No fields to update, just return the current document
      const document = await this.getDocumentById(id);
      if (!document) throw new Error(`Document with id ${id} not found`);
      return document;
    }

    values.push(id);
    const result = await this.pool.query(
      `
      UPDATE documents 
      SET ${updateFields.join(", ")} 
      WHERE id = $${paramIndex} 
      RETURNING 
        id, 
        name,
        type,
        url,
        company_id as "companyId",
        candidate_id as "candidateId",
        created_at as "createdAt"
    `,
      values,
    );

    if (result.rows.length === 0) {
      throw new Error(`Document with id ${id} not found`);
    }

    return result.rows[0];
  }

  async deleteDocument(id: number): Promise<void> {
    // Get the document first to get the url for deleting the file
    const document = await this.getDocumentById(id);
    if (!document) {
      throw new Error(`Document with id ${id} not found`);
    }

    // Delete from database
    const result = await this.pool.query(
      "DELETE FROM documents WHERE id = $1",
      [id],
    );

    if (result.rowCount === 0) {
      throw new Error(`Document with id ${id} not found`);
    }

    // Extract the filename from the url
    const urlParts = document.url.split("/");
    const filename = urlParts[urlParts.length - 1];

    // If using Google Cloud Storage, delete the file
    if (process.env.GOOGLE_CLOUD_STORAGE_BUCKET) {
      try {
        console.log(`Attempting to delete file from GCS: ${filename}`);
        await this.storage
          .bucket(process.env.GOOGLE_CLOUD_STORAGE_BUCKET)
          .file(filename)
          .delete();
      } catch (error) {
        console.error(`Error deleting file from storage: ${error}`);
        // We don't throw here since the database record is already deleted
      }
    } else {
      // If using local storage, delete the file
      const path = require("path");
      const fs = require("fs");

      try {
        const filePath = path.join(
          process.cwd(),
          "public",
          "uploads",
          "documents",
          filename,
        );
        console.log(`Attempting to delete local file: ${filePath}`);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        console.error(`Error deleting local file: ${error}`);
        // We don't throw here since the database record is already deleted
      }
    }
  }

  // Comment operations
  async getCommentsByCandidate(candidateId: number): Promise<Comment[]> {
    const result = await this.pool.query(
      `
      SELECT 
        c.id, 
        c.content, 
        c.html_content AS "htmlContent", 
        c.candidate_id AS "candidateId", 
        c.user_id AS "userId", 
        c.company_id AS "companyId", 
        c.mentioned_user_ids AS "mentionedUserIds", 
        c.created_at AS "createdAt", 
        c.updated_at AS "updatedAt",
        u.full_name AS "userFullName",
        u.avatar_url AS "userAvatarUrl",
        u.avatar_color AS "userAvatarColor"
      FROM 
        comments c
      JOIN
        users u ON c.user_id = u.id
      WHERE 
        c.candidate_id = $1
      ORDER BY 
        c.created_at ASC
    `,
      [candidateId],
    );

    return result.rows;
  }

  async createComment(comment: InsertComment): Promise<Comment> {
    const {
      content,
      htmlContent,
      candidateId,
      userId,
      companyId,
      mentionedUserIds,
    } = comment;

    const result = await this.pool.query(
      `
      INSERT INTO comments (
        content, 
        html_content, 
        candidate_id, 
        user_id, 
        company_id, 
        mentioned_user_ids,
        created_at,
        updated_at
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING 
        id, 
        content, 
        html_content AS "htmlContent", 
        candidate_id AS "candidateId", 
        user_id AS "userId", 
        company_id AS "companyId", 
        mentioned_user_ids AS "mentionedUserIds", 
        created_at AS "createdAt", 
        updated_at AS "updatedAt"
    `,
      [content, htmlContent, candidateId, userId, companyId, mentionedUserIds],
    );

    const newComment = result.rows[0];

    // If there are mentioned users, create notifications for them
    if (mentionedUserIds && mentionedUserIds.length > 0) {
      const commentingUser = await this.getUser(userId);
      const candidate = await this.getCandidateById(candidateId);

      if (commentingUser && candidate) {
        for (const mentionedUserId of mentionedUserIds) {
          // Don't notify yourself
          if (mentionedUserId !== userId) {
            await this.createNotification({
              userId: mentionedUserId,
              type: "comment_mention",
              title: "You were mentioned in a comment",
              message: `${commentingUser.fullName} mentioned you in a comment on ${candidate.fullName}'s profile`,
              relatedId: candidateId,
              relatedType: "candidate",
            });
          }
        }
      }
    }

    return newComment;
  }

  async updateComment(
    id: number,
    commentUpdate: Partial<InsertComment>,
  ): Promise<Comment> {
    const { content, htmlContent, mentionedUserIds } = commentUpdate;

    // Get existing comment to find newly mentioned users
    const existingComment = await this.pool.query(
      "SELECT * FROM comments WHERE id = $1",
      [id],
    );

    if (existingComment.rows.length === 0) {
      throw new Error(`Comment with id ${id} not found`);
    }

    const oldComment = existingComment.rows[0];
    const oldMentionedUserIds = oldComment.mentioned_user_ids || [];

    // Update the comment in the database
    const result = await this.pool.query(
      `
      UPDATE comments 
      SET 
        content = COALESCE($1, content),
        html_content = COALESCE($2, html_content),
        mentioned_user_ids = COALESCE($3, mentioned_user_ids),
        updated_at = NOW()
      WHERE 
        id = $4
      RETURNING 
        id, 
        content, 
        html_content AS "htmlContent", 
        candidate_id AS "candidateId", 
        user_id AS "userId", 
        company_id AS "companyId", 
        mentioned_user_ids AS "mentionedUserIds", 
        created_at AS "createdAt", 
        updated_at AS "updatedAt"
    `,
      [content, htmlContent, mentionedUserIds, id],
    );

    if (result.rows.length === 0) {
      throw new Error(`Comment with id ${id} not found`);
    }

    const updatedComment = result.rows[0];

    // Find newly mentioned users and notify them
    if (mentionedUserIds && mentionedUserIds.length > 0) {
      const newMentions = mentionedUserIds.filter(
        (userId) => !oldMentionedUserIds.includes(userId),
      );

      if (newMentions.length > 0) {
        const commentingUser = await this.getUser(oldComment.user_id);
        const candidate = await this.getCandidateById(oldComment.candidate_id);

        if (commentingUser && candidate) {
          for (const mentionedUserId of newMentions) {
            // Don't notify yourself
            if (mentionedUserId !== oldComment.user_id) {
              await this.createNotification({
                userId: mentionedUserId,
                type: "comment_mention",
                title: "You were mentioned in a comment",
                message: `${commentingUser.fullName} mentioned you in a comment on ${candidate.fullName}'s profile`,
                relatedId: candidate.id,
                relatedType: "candidate",
              });
            }
          }
        }
      }
    }

    return updatedComment;
  }

  async deleteComment(id: number): Promise<void> {
    const result = await this.pool.query("DELETE FROM comments WHERE id = $1", [
      id,
    ]);

    if (result.rowCount === 0) {
      throw new Error(`Comment with id ${id} not found`);
    }
  }

  // Location methods - these are now implemented below

  // Location operations
  async getLocationsByCompany(companyId: number): Promise<Location[]> {
    const result = await this.pool.query(
      `
      SELECT 
        id, 
        name,
        street_address AS "streetAddress", 
        city,
        county,
        state,
        zip_code AS "zipCode",
        company_id AS "companyId",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM 
        locations 
      WHERE 
        company_id = $1
      ORDER BY
        name ASC
    `,
      [companyId],
    );

    return result.rows;
  }

  async getLocationById(id: number): Promise<Location | undefined> {
    const result = await this.pool.query(
      `
      SELECT 
        id, 
        name,
        street_address AS "streetAddress", 
        city,
        county,
        state,
        zip_code AS "zipCode",
        company_id AS "companyId",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM 
        locations 
      WHERE 
        id = $1
    `,
      [id],
    );

    return result.rows[0];
  }

  async createLocation(location: InsertLocation): Promise<Location> {
    const result = await this.pool.query(
      `
      INSERT INTO locations (
        name,
        street_address,
        city,
        county,
        state,
        zip_code,
        company_id,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, NOW(), NOW()
      ) RETURNING 
        id, 
        name,
        street_address AS "streetAddress", 
        city,
        county,
        state,
        zip_code AS "zipCode",
        company_id AS "companyId",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `,
      [
        location.name,
        location.streetAddress,
        location.city,
        location.county,
        location.state,
        location.zipCode,
        location.companyId,
      ],
    );

    return result.rows[0];
  }

  async updateLocation(
    id: number,
    locationUpdate: Partial<InsertLocation>,
  ): Promise<Location> {
    // First verify the location exists
    const existingLocation = await this.getLocationById(id);
    if (!existingLocation) {
      throw new Error(`Location with id ${id} not found`);
    }

    // Construct dynamic update query
    const fields = [
      "name",
      "street_address",
      "city",
      "county",
      "state",
      "zip_code",
      "company_id",
    ];

    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Build the dynamic query
    fields.forEach((field) => {
      const camelField = field.replace(/_([a-z])/g, (g) => g[1].toUpperCase());

      if (
        locationUpdate[camelField as keyof typeof locationUpdate] !== undefined
      ) {
        updateFields.push(`${field} = $${paramIndex}`);
        values.push(locationUpdate[camelField as keyof typeof locationUpdate]);
        paramIndex++;
      }
    });

    // Always update the updated_at timestamp
    updateFields.push(`updated_at = NOW()`);

    // If there are no fields to update, just return the existing location
    if (values.length === 0) {
      return existingLocation;
    }

    // Add the location ID as the last parameter
    values.push(id);

    // Execute the update query
    const result = await this.pool.query(
      `
      UPDATE locations 
      SET ${updateFields.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING 
        id, 
        name,
        street_address AS "streetAddress", 
        city,
        county,
        state,
        zip_code AS "zipCode",
        company_id AS "companyId",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `,
      values,
    );

    return result.rows[0];
  }

  async deleteLocation(id: number): Promise<void> {
    const result = await this.pool.query(
      "DELETE FROM locations WHERE id = $1",
      [id],
    );

    if (result.rowCount === 0) {
      throw new Error(`Location with id ${id} not found`);
    }
  }

  async getJobsByLocation(locationId: number): Promise<Job[]> {
    const result = await this.pool.query(
      `
      SELECT 
        id, 
        title, 
        department, 
        location_id AS "locationId",
        type, 
        status, 
        description, 
        application_link AS "applicationLink", 
        company_id AS "companyId", 
        category, 
        experience, 
        salary_start AS "salaryStart", 
        salary_end AS "salaryEnd", 
        payment_type AS "paymentType", 
        currency, 
        internal_code AS "internalCode", 
        education, 
        created_at AS "createdAt"
      FROM 
        jobs 
      WHERE 
        location_id = $1
      ORDER BY 
        created_at DESC
    `,
      [locationId],
    );

    return result.rows;
  }

  // Notification operations
  async getNotificationsByUser(userId: number): Promise<Notification[]> {
    const result = await this.pool.query(
      `
      SELECT 
        id, 
        user_id AS "userId", 
        type, 
        title, 
        message, 
        read, 
        related_id AS "relatedId", 
        related_type AS "relatedType", 
        created_at AS "createdAt"
      FROM 
        notifications 
      WHERE 
        user_id = $1
      ORDER BY 
        created_at DESC
    `,
      [userId],
    );

    return result.rows;
  }

  async getUnreadNotificationsByUser(userId: number): Promise<Notification[]> {
    const result = await this.pool.query(
      `
      SELECT 
        id, 
        user_id AS "userId", 
        type, 
        title, 
        message, 
        read, 
        related_id AS "relatedId", 
        related_type AS "relatedType", 
        created_at AS "createdAt"
      FROM 
        notifications 
      WHERE 
        user_id = $1 AND read = false
      ORDER BY 
        created_at DESC
    `,
      [userId],
    );

    return result.rows;
  }

  async createNotification(
    notification: InsertNotification,
  ): Promise<Notification> {
    const result = await this.pool.query(
      `
      INSERT INTO notifications (
        user_id, 
        type, 
        title, 
        message, 
        related_id, 
        related_type, 
        created_at
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING 
        id, 
        user_id AS "userId", 
        type, 
        title, 
        message, 
        read, 
        related_id AS "relatedId", 
        related_type AS "relatedType", 
        created_at AS "createdAt"
    `,
      [
        notification.userId,
        notification.type,
        notification.title,
        notification.message,
        notification.relatedId,
        notification.relatedType,
      ],
    );

    return result.rows[0];
  }

  async markNotificationAsRead(id: number): Promise<void> {
    const result = await this.pool.query(
      `
      UPDATE notifications 
      SET read = true 
      WHERE id = $1
    `,
      [id],
    );

    if (result.rowCount === 0) {
      throw new Error(`Notification with id ${id} not found`);
    }
  }

  async markAllNotificationsAsRead(userId: number): Promise<void> {
    await this.pool.query(
      `
      UPDATE notifications 
      SET read = true 
      WHERE user_id = $1 AND read = false
    `,
      [userId],
    );
  }

  // Support ticket operations
  async getSupportTicketsByUser(userId: number): Promise<SupportTicket[]> {
    const result = await this.pool.query(
      `
      SELECT 
        id, 
        user_id AS "userId", 
        company_id AS "companyId", 
        subject, 
        description, 
        category, 
        priority, 
        status, 
        created_at AS "createdAt", 
        updated_at AS "updatedAt"
      FROM 
        support_tickets 
      WHERE 
        user_id = $1
      ORDER BY 
        created_at DESC
    `,
      [userId],
    );

    return result.rows;
  }

  async getSupportTicketsByCompany(
    companyId: number,
  ): Promise<SupportTicket[]> {
    const result = await this.pool.query(
      `
      SELECT 
        id, 
        user_id AS "userId", 
        company_id AS "companyId", 
        subject, 
        description, 
        category, 
        priority, 
        status, 
        created_at AS "createdAt", 
        updated_at AS "updatedAt"
      FROM 
        support_tickets 
      WHERE 
        company_id = $1
      ORDER BY 
        created_at DESC
    `,
      [companyId],
    );

    return result.rows;
  }

  async createSupportTicket(
    ticket: InsertSupportTicket,
  ): Promise<SupportTicket> {
    const result = await this.pool.query(
      `
      INSERT INTO support_tickets (
        user_id, 
        company_id, 
        subject, 
        description, 
        category, 
        priority, 
        created_at, 
        updated_at
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING 
        id, 
        user_id AS "userId", 
        company_id AS "companyId", 
        subject, 
        description, 
        category, 
        priority, 
        status, 
        created_at AS "createdAt", 
        updated_at AS "updatedAt"
    `,
      [
        ticket.userId,
        ticket.companyId,
        ticket.subject,
        ticket.description,
        ticket.category,
        ticket.priority,
      ],
    );

    return result.rows[0];
  }

  async updateSupportTicket(
    id: number,
    ticketUpdate: Partial<InsertSupportTicket>,
  ): Promise<SupportTicket> {
    const { subject, description, category, priority } = ticketUpdate;

    const result = await this.pool.query(
      `
      UPDATE support_tickets 
      SET 
        subject = COALESCE($1, subject),
        description = COALESCE($2, description),
        category = COALESCE($3, category),
        priority = COALESCE($4, priority),
        updated_at = NOW()
      WHERE 
        id = $5
      RETURNING 
        id, 
        user_id AS "userId", 
        company_id AS "companyId", 
        subject, 
        description, 
        category, 
        priority, 
        status, 
        created_at AS "createdAt", 
        updated_at AS "updatedAt"
    `,
      [subject, description, category, priority, id],
    );

    if (result.rows.length === 0) {
      throw new Error(`Support ticket with id ${id} not found`);
    }

    return result.rows[0];
  }

  // Application Form Analytics operations
  async createApplicationFormAnalytics(
    analytics: InsertApplicationFormAnalytics,
  ): Promise<ApplicationFormAnalytics> {
    const result = await this.pool.query(
      `
      INSERT INTO application_form_analytics (
        job_id, company_id, session_id, ip_address, user_agent, referrer,
        form_started, form_completed, candidate_created, step_reached, total_steps,
        time_to_complete, abandonment_step, device_type, browser_name
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING 
        id, job_id as "jobId", company_id as "companyId", session_id as "sessionId",
        ip_address as "ipAddress", user_agent as "userAgent", referrer,
        form_started as "formStarted", form_completed as "formCompleted", 
        candidate_created as "candidateCreated", step_reached as "stepReached",
        total_steps as "totalSteps", time_to_complete as "timeToComplete",
        abandonment_step as "abandonmentStep", device_type as "deviceType",
        browser_name as "browserName", created_at as "createdAt", updated_at as "updatedAt"
    `,
      [
        analytics.jobId,
        analytics.companyId,
        analytics.sessionId,
        analytics.ipAddress,
        analytics.userAgent,
        analytics.referrer,
        analytics.formStarted,
        analytics.formCompleted,
        analytics.candidateCreated,
        analytics.stepReached,
        analytics.totalSteps,
        analytics.timeToComplete,
        analytics.abandonmentStep,
        analytics.deviceType,
        analytics.browserName,
      ],
    );
    return result.rows[0];
  }

  async updateApplicationFormAnalytics(
    sessionId: string,
    updates: Partial<InsertApplicationFormAnalytics>,
  ): Promise<ApplicationFormAnalytics> {
    const setClause = [];
    const values = [];
    let paramIndex = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        const dbKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
        setClause.push(`${dbKey} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });

    setClause.push(`updated_at = NOW()`);
    values.push(sessionId);

    const result = await this.pool.query(
      `
      UPDATE application_form_analytics 
      SET ${setClause.join(", ")}
      WHERE session_id = $${paramIndex}
      RETURNING 
        id, job_id as "jobId", company_id as "companyId", session_id as "sessionId",
        ip_address as "ipAddress", user_agent as "userAgent", referrer,
        form_started as "formStarted", form_completed as "formCompleted", 
        candidate_created as "candidateCreated", step_reached as "stepReached",
        total_steps as "totalSteps", time_to_complete as "timeToComplete",
        abandonment_step as "abandonmentStep", device_type as "deviceType",
        browser_name as "browserName", created_at as "createdAt", updated_at as "updatedAt"
    `,
      values,
    );

    if (result.rows.length === 0) {
      throw new Error(
        `Application form analytics with session ID ${sessionId} not found`,
      );
    }
    return result.rows[0];
  }

  async getApplicationFormAnalyticsByJob(
    jobId: number,
  ): Promise<ApplicationFormAnalytics[]> {
    const result = await this.pool.query(
      `
      SELECT 
        id, job_id as "jobId", company_id as "companyId", session_id as "sessionId",
        ip_address as "ipAddress", user_agent as "userAgent", referrer,
        form_started as "formStarted", form_completed as "formCompleted", 
        candidate_created as "candidateCreated", step_reached as "stepReached",
        total_steps as "totalSteps", time_to_complete as "timeToComplete",
        abandonment_step as "abandonmentStep", device_type as "deviceType",
        browser_name as "browserName", created_at as "createdAt", updated_at as "updatedAt"
      FROM application_form_analytics 
      WHERE job_id = $1
      ORDER BY created_at DESC
    `,
      [jobId],
    );
    return result.rows;
  }

  async getApplicationFormAnalyticsByCompany(
    companyId: number,
  ): Promise<ApplicationFormAnalytics[]> {
    const result = await this.pool.query(
      `
      SELECT 
        id, job_id as "jobId", company_id as "companyId", session_id as "sessionId",
        ip_address as "ipAddress", user_agent as "userAgent", referrer,
        form_started as "formStarted", form_completed as "formCompleted", 
        candidate_created as "candidateCreated", step_reached as "stepReached",
        total_steps as "totalSteps", time_to_complete as "timeToComplete",
        abandonment_step as "abandonmentStep", device_type as "deviceType",
        browser_name as "browserName", created_at as "createdAt", updated_at as "updatedAt"
      FROM application_form_analytics 
      WHERE company_id = $1
      ORDER BY created_at DESC
    `,
      [companyId],
    );
    return result.rows;
  }

  async getConversionRatesByCompany(
    companyId: number,
    dateRange?: { startDate: Date; endDate: Date },
  ) {
    let whereClause = "WHERE company_id = $1";
    const values = [companyId];

    if (dateRange) {
      whereClause += " AND created_at >= $2 AND created_at <= $3";
      values.push(dateRange.startDate, dateRange.endDate);
    }

    // Get basic conversion metrics
    const metricsResult = await this.pool.query(
      `
      SELECT 
        COUNT(*) as total_started,
        COUNT(CASE WHEN form_completed = true THEN 1 END) as total_completed,
        COUNT(CASE WHEN candidate_created = true THEN 1 END) as total_converted,
        AVG(CASE WHEN time_to_complete IS NOT NULL THEN time_to_complete END) as avg_time_to_complete
      FROM application_form_analytics 
      ${whereClause} AND form_started = true
    `,
      values,
    );

    // Get source performance
    const sourcesResult = await this.pool.query(
      `
      SELECT 
        COALESCE(referrer, 'Direct') as source,
        COUNT(CASE WHEN candidate_created = true THEN 1 END) as conversions,
        COUNT(*) as total_sessions
      FROM application_form_analytics 
      ${whereClause} AND form_started = true
      GROUP BY referrer
      ORDER BY conversions DESC
      LIMIT 10
    `,
      values,
    );

    // Get device breakdown
    const devicesResult = await this.pool.query(
      `
      SELECT 
        COALESCE(device_type, 'Unknown') as device,
        COUNT(*) as count
      FROM application_form_analytics 
      ${whereClause} AND form_started = true
      GROUP BY device_type
      ORDER BY count DESC
    `,
      values,
    );

    // Get abandonment analysis
    const abandonmentResult = await this.pool.query(
      `
      SELECT 
        abandonment_step as step,
        COUNT(*) as count
      FROM application_form_analytics 
      ${whereClause} AND form_started = true AND form_completed = false AND abandonment_step IS NOT NULL
      GROUP BY abandonment_step
      ORDER BY step ASC
    `,
      values,
    );

    const metrics = metricsResult.rows[0];
    const totalStarted = parseInt(metrics.total_started);
    const totalCompleted = parseInt(metrics.total_completed);
    const totalConverted = parseInt(metrics.total_converted);

    const conversionRate =
      totalStarted > 0 ? (totalConverted / totalStarted) * 100 : 0;
    const completionRate =
      totalStarted > 0 ? (totalCompleted / totalStarted) * 100 : 0;
    const avgTimeToComplete = parseFloat(metrics.avg_time_to_complete) || 0;

    const topSources = sourcesResult.rows.map((row) => ({
      source: row.source,
      conversions: parseInt(row.conversions),
      rate:
        parseInt(row.total_sessions) > 0
          ? (parseInt(row.conversions) / parseInt(row.total_sessions)) * 100
          : 0,
    }));

    const totalDeviceSessions = devicesResult.rows.reduce(
      (sum, row) => sum + parseInt(row.count),
      0,
    );
    const deviceBreakdown = devicesResult.rows.map((row) => ({
      device: row.device,
      count: parseInt(row.count),
      percentage:
        totalDeviceSessions > 0
          ? (parseInt(row.count) / totalDeviceSessions) * 100
          : 0,
    }));

    const totalAbandoned = abandonmentResult.rows.reduce(
      (sum, row) => sum + parseInt(row.count),
      0,
    );
    const abandonmentAnalysis = abandonmentResult.rows.map((row) => ({
      step: parseInt(row.step),
      count: parseInt(row.count),
      percentage:
        totalAbandoned > 0 ? (parseInt(row.count) / totalAbandoned) * 100 : 0,
    }));

    return {
      totalStarted,
      totalCompleted,
      totalConverted,
      conversionRate: Math.round(conversionRate * 100) / 100,
      completionRate: Math.round(completionRate * 100) / 100,
      avgTimeToComplete: Math.round(avgTimeToComplete),
      topSources,
      deviceBreakdown,
      abandonmentAnalysis,
    };
  }
}

// Export an instance of DatabaseStorage
export const storage = new DatabaseStorage();
