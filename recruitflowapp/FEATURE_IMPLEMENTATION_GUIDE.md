# Developer's Guide: Implementing Configurable Form Fields

This document provides a comprehensive, step-by-step guide for adding new, configurable fields to the job application form. It is intended for developers working on this project and provides detailed code examples and explanations for each layer of the application stack.

## Use Case: Adding a "Cover Letter" Field

To make this guide practical, we will walk through the process of adding a new "Cover Letter" field. This feature will have two settings:

1.  **Enable Cover Letter:** A toggle to show or hide the field on the public application form.
2.  **Require Cover Letter:** A toggle (only active if the field is enabled) to make it a mandatory field for applicants.

---

## The End-to-End Workflow

Adding a new feature requires touching every part of the application stack. Following these steps ensures that data flows correctly and the feature is fully integrated.

### **Step 1: Database Schema (`shared/schema.ts`)**

The foundation of any new feature is its representation in the database.

**File:** `shared/schema.ts`

**Objective:** Add columns to the `jobs` table to store the configuration for the Cover Letter feature.

**Action:**
1.  Add `enableCoverLetter` and `requireCoverLetter` as `boolean` columns to the `jobs` table definition. Provide default values to ensure existing job postings are not affected.
2.  Add these new properties to the `insertJobSchema` to allow them to be validated and saved during job creation and updates.

```typescript
// recruitflowapp/shared/schema.ts

// ... imports

export const jobs = pgTable(
  "jobs",
  {
    // ... existing fields
    requireAddress: boolean("require_address").default(true),
    requireResume: boolean("require_resume").default(true),
    showLicenseOptions: boolean("show_license_options").default(false),
    licenseStateName: text("license_state_name"),

    // Add new fields for the Cover Letter feature
    enableCoverLetter: boolean("enable_cover_letter").default(false),
    requireCoverLetter: boolean("require_cover_letter").default(false),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  }
);

export const insertJobSchema = createInsertSchema(jobs).pick({
  // ... existing fields
  requireAddress: true,
  showLicenseOptions: true,
  licenseStateName: true,
  requireResume: true,
  
  // Add the new fields here as well
  enableCoverLetter: true,
  requireCoverLetter: true,
});

// ... rest of the file
```

---

### **Step 2: Backend Storage Layer (`server/storage.ts`)**

The storage layer handles all direct database communication. The SQL queries must be updated to read and write the new fields.

**File:** `server/storage.ts`

**Objective:** Update all functions that create, update, or retrieve job data to handle the new `enableCoverLetter` and `requireCoverLetter` fields.

**Action:**
1.  **`createJob`:** Add `enable_cover_letter` and `require_cover_letter` to the `INSERT` statement and the `RETURNING` clause.
2.  **`updateJob`:** Add the new fields to the `SET` clause of the `UPDATE` statement and the `RETURNING` clause.
3.  **`getJobById` & `getJobByApplicationLink`:** Add the new fields to the `SELECT` statement to ensure they are fetched and sent to the frontend.

**Example (`updateJob` function):**
```typescript
// recruitflowapp/server/storage.ts

// ... in the updateJob method
const result = await this.pool.query(
  `
  UPDATE jobs 
  SET 
    -- ... other fields
    require_address = $19,
    show_license_options = $20,
    license_state_name = $21,
    require_resume = $22,
    -- Add the new fields
    enable_cover_letter = $23,
    require_cover_letter = $24
  WHERE id = $25
  RETURNING 
    -- ... other fields
    require_address as "requireAddress",
    show_license_options as "showLicenseOptions",
    license_state_name as "licenseStateName",
    require_resume as "requireResume",
    -- Add the new fields to the returning clause
    enable_cover_letter as "enableCoverLetter",
    require_cover_letter as "requireCoverLetter"
`,
  [
    // ... other parameters
    jobUpdate.requireAddress,
    jobUpdate.showLicenseOptions,
    jobUpdate.licenseStateName,
    jobUpdate.requireResume,
    // Pass the new values
    jobUpdate.enableCoverLetter,
    jobUpdate.requireCoverLetter,
    id,
  ],
);
```
**Note:** You must apply similar changes to all functions that interact with the `jobs` table.

---

### **Step 3: Admin Configuration UI (`client/src/pages/edit-job.tsx`)**

Now, create the UI for administrators to configure the new feature.

**File:** `client/src/pages/edit-job.tsx`

**Objective:** Add `Switch` controls to the "Application Form" settings to allow admins to enable and require the Cover Letter field.

**Action:**
1.  Add `enableCoverLetter` and `requireCoverLetter` to the `formData` state.
2.  Add a new block of JSX with two `Switch` components, one for enabling and one for requiring. The "Required" switch should be disabled if the feature is not enabled.
3.  Ensure the `handleSaveChanges` function includes the new fields in the `jobData` payload sent to the server.

**Example JSX:**
```jsx
// recruitflowapp/client/src/pages/edit-job.tsx

// ... inside the "Application Form" tab rendering
<div className="flex items-center justify-between py-3 border-b">
  <div>
    <p className="font-medium">Cover Letter</p>
    <p className="text-sm text-gray-500">
      Allow candidates to submit a cover letter.
    </p>
  </div>
  <div className="flex items-center space-x-4">
    <div className="flex items-center space-x-2">
      <Switch
        id="enableCoverLetter"
        checked={formData.enableCoverLetter}
        onCheckedChange={(checked) =>
          handleFormToggle("enableCoverLetter", checked)
        }
      />
      <Label htmlFor="enableCoverLetter">Enable</Label>
    </div>
    <div className="flex items-center space-x-2">
      <Switch
        id="requireCoverLetter"
        checked={formData.requireCoverLetter}
        onCheckedChange={(checked) =>
          handleFormToggle("requireCoverLetter", checked)
        }
        disabled={!formData.enableCoverLetter}
      />
      <Label htmlFor="requireCoverLetter" className={!formData.enableCoverLetter ? "text-gray-400" : ""}>
        Required
      </Label>
    </div>
  </div>
</div>
```

---

### **Step 4: API Data Passthrough (`server/routes.ts`)**

The backend API must be explicitly told to pass the new configuration fields to the public application form.

**File:** `server/routes.ts`

**Objective:** Update the public-facing job-fetching routes to include the new fields in their response.

**Action:**
Locate the routes that call `storage.getJobByApplicationLink` (e.g., `/api/application/:link`). Add the new fields to the `res.json()` call.

**Example:**
```typescript
// recruitflowapp/server/routes.ts

// ... in the GET /api/application/:link route handler
res.json({
  // ... other job properties
  requireAddress: job.requireAddress,
  showLicenseOptions: job.showLicenseOptions,
  licenseStateName: job.licenseStateName,
  requireResume: job.requireResume,
  // Add the new fields to the response
  enableCoverLetter: job.enableCoverLetter,
  requireCoverLetter: job.requireCoverLetter
});
```

---

### **Step 5: Public Application Form UI (`client/src/pages/application-form.tsx`)**

Finally, render the feature on the public form based on the job's configuration.

**File:** `client/src/pages/application-form.tsx` (or the `enhanced-application-form.tsx` component)

**Objective:** Conditionally render the "Cover Letter" `Textarea` and apply the required validation rule.

**Action:**
1.  Wrap the form field's JSX in a conditional check based on the `enableCoverLetter` prop.
2.  Update the `zod` validation schema to dynamically add a `min(1)` requirement if `requireCoverLetter` is true.

**Example:**
```jsx
// recruitflowapp/client/src/pages/application-form.tsx

// --- In the validation schema setup ---
const form = useForm<z.infer<typeof applicationFormSchema>>({
  resolver: zodResolver(
    applicationFormSchema.extend({
      coverLetter: job.enableCoverLetter && job.requireCoverLetter
        ? z.string().min(1, "Cover letter is required.")
        : z.string().optional(),
    })
  ),
  // ...
});

// --- In the JSX rendering ---
{job.enableCoverLetter && (
  <FormField
    control={form.control}
    name="coverLetter"
    render={({ field }) => (
      <FormItem>
        <FormLabel>
          Cover Letter {job.requireCoverLetter && <span className="text-red-500">*</span>}
        </FormLabel>
        <FormControl>
          <Textarea
            placeholder="Tell us why you're a great fit for this role..."
            {...field}
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
)}
```

---

## Step 6: Saving Submitted Data

The final piece of the puzzle is ensuring that when a candidate submits the application, the data from your new fields is actually saved.

**File:** `server/routes.ts` & `server/storage.ts`

**Objective:** Update the application submission endpoint and the candidate creation logic to handle the new data.

**Action:**
1.  **Update `createCandidate` (`storage.ts`):** The `createCandidate` function must be updated to accept the new fields (`isLicensed`, `wantsLicense`, etc.) and include them in its `INSERT` statement.
2.  **Update API Route (`routes.ts`):** The application submission route (e.g., `POST /api/applications`) must be updated to pass the new fields from the validated request body to the `createCandidate` function.

**Example (`routes.ts`):**
```typescript
// recruitflowapp/server/routes.ts

// ... in the POST /api/applications route handler
const candidate = await storage.createCandidate({
  fullName: validatedData.fullName,
  email: validatedData.email,
  phone: validatedData.phone || null,
  // ... other standard fields
  
  // Pass the new data from the validated form body
  isLicensed: validatedData.isLicensed,
  wantsLicense: validatedData.wantsLicense,
  agreedToMarketing: validatedData.agreedToMarketing,
});
```

---

## Troubleshooting Guide

This section details common errors encountered during development and how to solve them.

### **Error Type 1: Server Crash on Save**
-   **Symptom:** The server returns a `500: {"error":"Failed to update job"}` error.
-   **Root Cause:** A mismatch between the database schema in `shared/schema.ts` and a SQL query in `server/storage.ts`. You are trying to write to a database column that does not exist.
-   **Solution:** Meticulously check every column name in your `INSERT` and `UPDATE` statements in `server/storage.ts` and ensure they exactly match the column names defined in `shared/schema.ts`.

### **Error Type 2: "Undefined" Properties on Frontend**
-   **Symptom:** A feature's configuration (e.g., `job.enableCoverLetter`) is `undefined` on the application form, causing the UI to render incorrectly or crash.
-   **Data Flow Checklist:**
    1.  **Storage:** Does your `getJob...` function in `server/storage.ts` include the new field in its `SELECT` statement?
    2.  **API Route:** Does the relevant API endpoint in `server/routes.ts` include the new field in the `res.json()` response?
-   **Solution:** Check the network tab in your browser's developer tools for any failing API requests. Fix the root cause of that failure, and the rest of the page should load correctly. Pay close attention to nested data structures (e.g., using `job.company.id` instead of the non-existent `job.companyId`).

### **Error Type 3: Page Fails to Load with "Bad Request"**
-   **Symptom:** The application form is blank. The browser console shows a `400 (Bad Request)` error for an API call that seems unrelated to your new feature (e.g., `/api/job-views`).
-   **Root Cause:** A critical, page-loading API call is failing, which stops the component from rendering. This is often caused by missing data in the request payload.
-   **Solution:** Check the network tab in your browser's developer tools for any failing API requests. Fix the root cause of that failure, and the rest of the page should load correctly. Pay close attention to nested data structures (e.g., using `job.company.id` instead of the non-existent `job.companyId`).

### **Error Type 4: "violates not-null constraint"**
-   **Symptom:** The server returns a `500` error, and the message mentions a `not-null constraint` for a specific column (e.g., `first_name`).
-   **Root Cause:** The application is trying to create a new database record but is failing to provide a required value. For example, the frontend may send a `fullName`, but the `createCandidate` function in `server/storage.ts` fails to split it into `firstName` and `lastName` before trying to `INSERT` it.
-   **Solution:** Ensure your storage layer functions correctly process incoming data to match what the database schema expects. If the database requires `first_name` and `last_name`, make sure your `create...` function generates them and includes them in the `INSERT` statement.

---

## Appendix: API Route Structure

The API has two types of routes: **Public** and **Protected**. Understanding the difference is crucial for security and functionality.

**File:** `server/routes.ts`

-   **Public Routes:**
    -   **Purpose:** Endpoints that must be accessible to the public without authentication. This primarily includes the endpoints for fetching job data for the application form and submitting the application itself.
    -   **Implementation:** These route handlers (e.g., `app.post('/api/applications', ...)`) are defined at the top of the `registerRoutes` function, *before* any security middleware is applied.

-   **Protected Routes:**
    -   **Purpose:** Endpoints that should only be accessible to authenticated users who belong to the correct tenant (company). This includes almost all internal API calls (e.g., creating jobs, viewing candidates, managing settings).
    -   **Implementation:** The `tenantSecurityMiddleware` is applied globally to the `/api` path. Any route defined *after* this middleware is automatically protected.

**Golden Rule:** When adding a new API endpoint, decide if it needs to be public. If so, add it to the "Public API Routes" section at the top of the file. Otherwise, add it after the middleware, and it will be protected by default. 