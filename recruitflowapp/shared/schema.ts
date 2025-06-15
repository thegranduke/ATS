import { pgTable, text, serial, integer, boolean, timestamp, jsonb, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),  // This is the email address
  email: text("email").notNull(),        // Add email field for consistency
  password: text("password").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  fullName: text("full_name").notNull(),
  companyId: integer("company_id").notNull(),
  role: text("role").notNull().default("user"),
  avatarUrl: text("avatar_url"),
  avatarColor: text("avatar_color").default("#7E57C2"), // Default to purple
}, (table) => {
  // Add a composite unique constraint for multi-tenant email uniqueness
  return {
    usernameCompanyIdx: unique("username_company_idx").on(table.username, table.companyId),
  };
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  password: true,
  firstName: true,
  lastName: true,
  fullName: true,
  companyId: true,
  role: true,
  avatarUrl: true,
  avatarColor: true,
});

// Companies table
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  industry: text("industry"),
  size: text("size"),
  brokerkitApiKey: text("brokerkit_api_key"),
  logoUrl: text("logo_url"), // Company logo URL for application forms
});

export const insertCompanySchema = createInsertSchema(companies).pick({
  name: true,
  industry: true,
  size: true,
  brokerkitApiKey: true,
  logoUrl: true,
});

// Jobs table
// Job status enum
export const jobStatusValues = ["active", "draft", "closed", "archived"] as const;
export const jobStatusSchema = z.enum(jobStatusValues);
export type JobStatusType = z.infer<typeof jobStatusSchema>;

export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  department: text("department").notNull(),
  locationId: integer("location_id").references(() => locations.id),
  type: text("type").notNull(),
  status: text("status").notNull().default("active"),
  description: text("description").notNull(), // Will store HTML content
  applicationLink: text("application_link").unique(),
  companyId: integer("company_id").notNull(),
  category: text("category"),
  experience: text("experience"),
  salaryStart: text("salary_start"),
  salaryEnd: text("salary_end"),
  paymentType: text("payment_type"),
  currency: text("currency"),
  internalCode: text("internal_code"),
  education: text("education"),

  // Application form configuration
  formHeaderText: text("form_header_text"),
  formDescription: text("form_description"),
  requireFirstName: boolean("require_first_name").default(true),
  requireLastName: boolean("require_last_name").default(true),
  requireEmail: boolean("require_email").default(true),
  requirePhone: boolean("require_phone").default(false),
  enablePhone: boolean("enable_phone").default(true),
  requireAddress: boolean("require_address").default(false),
  enableAddress: boolean("enable_address").default(true),
  requireResume: boolean("require_resume").default(true),
  showLicenseOptions: boolean("show_license_options").default(false),
  licenseStateName: text("license_state_name"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertJobSchema = createInsertSchema(jobs).pick({
  title: true,
  department: true,
  locationId: true,
  type: true,
  status: true,
  description: true,
  companyId: true,
  category: true,
  experience: true,
  salaryStart: true,
  salaryEnd: true,
  paymentType: true,
  currency: true,
  internalCode: true,
  education: true,
  formHeaderText: true,
  formDescription: true,
  requireFirstName: true,
  requireLastName: true,
  requireEmail: true,
  requirePhone: true,
  enablePhone: true,
  requireAddress: true,
  enableAddress: true,
  requireResume: true,
  showLicenseOptions: true,
  licenseStateName: true,
});

// Candidates table
export const candidates = pgTable("candidates", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  address: text("address"),
  resumeUrl: text("resume_url"),
  status: text("status").notNull().default("new"),
  notes: text("notes"),
  companyId: integer("company_id").notNull(),
  jobId: integer("job_id"),
  isLicensed: boolean("is_licensed"),
  wantsLicense: boolean("wants_license"),
  agreedToMarketing: boolean("agreed_to_marketing").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCandidateSchema = createInsertSchema(candidates).pick({
  fullName: true,
  email: true,
  phone: true,
  address: true,
  resumeUrl: true,
  status: true,
  notes: true,
  companyId: true,
  jobId: true,
  isLicensed: true,
  wantsLicense: true,
  agreedToMarketing: true,
});

// Registration schemas
export const companyRegistrationSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  username: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters")
}).transform(data => ({
  ...data,
  fullName: `${data.firstName} ${data.lastName}`
}));

export const loginSchema = z.object({
  username: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required")
});

export const applicationFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  address: z.string().optional(),
  isLicensed: z.boolean().optional(),
  wantsLicense: z.boolean().optional(),
  agreedToMarketing: z.boolean().default(false),
  sessionId: z.string().optional(),
  applicationLink: z.string().optional(),
  resumeUrl: z.string().optional(),
}).transform(data => ({
  ...data,
  fullName: `${data.firstName} ${data.lastName}`
}));

// User profile schema for settings page
export const userProfileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  username: z.string().email("Valid email address is required"),
  avatarColor: z.string().optional(),
  avatarUrl: z.string().optional().nullable(),
});

// Brokerkit API integration schema
export const brokerkitIntegrationSchema = z.object({
  brokerkitApiKey: z.string().min(40, "Brokerkit API key should be at least 40 characters")
    .regex(/^[a-z0-9]+$/, "Brokerkit API key should only contain lowercase letters and numbers"),
});

// Type definitions
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;

export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobs.$inferSelect;

export type InsertCandidate = z.infer<typeof insertCandidateSchema>;
export type Candidate = typeof candidates.$inferSelect;

export type CompanyRegistration = z.infer<typeof companyRegistrationSchema>;
export type Login = z.infer<typeof loginSchema>;
export type ApplicationForm = z.infer<typeof applicationFormSchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
export type BrokerkitIntegration = z.infer<typeof brokerkitIntegrationSchema>;

// Job Views table for analytics
export const jobViews = pgTable("job_views", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  referrer: text("referrer"),
  viewedAt: timestamp("viewed_at").notNull().defaultNow(),
});

export const insertJobViewSchema = createInsertSchema(jobViews).pick({
  jobId: true,
  companyId: true,
  ipAddress: true,
  userAgent: true,
  referrer: true,
});

export type InsertJobView = z.infer<typeof insertJobViewSchema>;
export type JobView = typeof jobViews.$inferSelect;

// Documents table
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  url: text("url").notNull(),
  companyId: integer("company_id").notNull(),
  candidateId: integer("candidate_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDocumentSchema = createInsertSchema(documents).pick({
  name: true,
  type: true,
  url: true,
  companyId: true,
  candidateId: true,
});

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

// Comments table
export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  htmlContent: text("html_content").notNull(),
  candidateId: integer("candidate_id").notNull().references(() => candidates.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  mentionedUserIds: integer("mentioned_user_ids").array(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCommentSchema = createInsertSchema(comments).pick({
  content: true,
  htmlContent: true,
  candidateId: true,
  userId: true,
  companyId: true,
  mentionedUserIds: true,
});

export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Comment = typeof comments.$inferSelect;

// Application Form Analytics table
export const applicationFormAnalytics = pgTable("application_form_analytics", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  sessionId: text("session_id").notNull(), // Unique session for tracking form progress
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  referrer: text("referrer"), // Source tracking (LinkedIn, Indeed, etc.)
  formStarted: boolean("form_started").default(false).notNull(),
  formCompleted: boolean("form_completed").default(false).notNull(),
  candidateCreated: boolean("candidate_created").default(false).notNull(),
  stepReached: integer("step_reached").default(1).notNull(), // Highest step reached in form
  totalSteps: integer("total_steps").default(3).notNull(), // Total steps in application form
  timeToComplete: integer("time_to_complete"), // Time in seconds to complete form
  abandonmentStep: integer("abandonment_step"), // Step where user abandoned form
  deviceType: text("device_type"), // mobile, tablet, desktop
  browserName: text("browser_name"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertApplicationFormAnalyticsSchema = createInsertSchema(applicationFormAnalytics).pick({
  jobId: true,
  companyId: true,
  sessionId: true,
  ipAddress: true,
  userAgent: true,
  referrer: true,
  formStarted: true,
  formCompleted: true,
  candidateCreated: true,
  stepReached: true,
  totalSteps: true,
  timeToComplete: true,
  abandonmentStep: true,
  deviceType: true,
  browserName: true,
});

export type InsertApplicationFormAnalytics = z.infer<typeof insertApplicationFormAnalyticsSchema>;
export type ApplicationFormAnalytics = typeof applicationFormAnalytics.$inferSelect;



// Notifications schema
export const notificationTypeValues = ["new_candidate", "new_job", "status_change", "comment_mention", "system"] as const;
export const notificationTypeSchema = z.enum(notificationTypeValues);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type", { enum: notificationTypeValues }).notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  read: boolean("read").notNull().default(false),
  relatedId: integer("related_id"),
  relatedType: text("related_type"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notifications).pick({
  userId: true,
  type: true,
  title: true,
  message: true,
  relatedId: true,
  relatedType: true,
});

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// Locations table for company office/branch locations
export const locations = pgTable("locations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  streetAddress: text("street_address").notNull(),
  city: text("city").notNull(),
  county: text("county"),
  state: text("state").notNull(),
  zipCode: text("zip_code").notNull(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertLocationSchema = createInsertSchema(locations).pick({
  name: true,
  streetAddress: true,
  city: true,
  county: true,
  state: true,
  zipCode: true,
  companyId: true,
});

export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type Location = typeof locations.$inferSelect;

// Support tickets table
export const supportTicketStatusValues = ["open", "in_progress", "resolved", "closed"] as const;
export const supportTicketPriorityValues = ["low", "medium", "high", "urgent"] as const;

export const supportTickets = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  priority: text("priority", { enum: supportTicketPriorityValues }).notNull().default("medium"),
  status: text("status", { enum: supportTicketStatusValues }).notNull().default("open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSupportTicketSchema = createInsertSchema(supportTickets).pick({
  userId: true,
  companyId: true,
  subject: true,
  description: true,
  category: true,
  priority: true,
});

export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type SupportTicket = typeof supportTickets.$inferSelect;