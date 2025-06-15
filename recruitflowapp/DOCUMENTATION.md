# Documentation: Implementing Toggleable and Required Fields

This document outlines the steps taken to implement the "Phone" and "Address" fields feature, where they can be toggled on/off and set as required. This can be used as a blueprint for adding similar functionality for other fields.

## 1. Database Schema (`shared/schema.ts`)

The first step is to define the necessary fields in the database schema. For this feature, we added four new boolean fields to the `jobs` table:

- `enablePhone`: Controls if the phone number field is visible on the application form.
- `requirePhone`: Controls if the phone number is a required field.
- `enableAddress`: Controls if the address field is visible on the application form.
- `requireAddress`: Controls if the address is a required field.

These fields are defined with default values to ensure that existing records are not affected.

## 2. Backend Storage (`server/storage.ts`)

The storage layer is responsible for reading from and writing to the database. The following changes were made:

- **`createJob` and `updateJob`:** These functions were updated to accept the new boolean fields and save them to the database.
- **`getJobById`:** This function was updated to retrieve the new fields, so they can be passed to the frontend.

## 3. API Endpoints (`server/routes.ts`)

The API endpoints connect the frontend to the backend.

- The `PUT /api/jobs/:id` endpoint was modified to accept `enablePhone`, `requirePhone`, `enableAddress`, and `requireAddress` in the request body.
- The `insertJobSchema` is used for server-side validation to ensure that the incoming data is of the correct type (boolean).

## 4. Frontend UI (`client/src/pages/edit-job.tsx`)

This is where the user interacts with the feature.

- **State Management:** The `formData` state object was updated to include the four new boolean fields.
- **UI Controls:**
    - Two sets of `Switch` components were added to the "Application Form" tab.
    - The "Enable" switch controls the visibility of the field on the application form.
    - The "Required" switch is disabled if the field is not enabled, and controls whether the field is mandatory.
- **Event Handling:**
    - The `handleFormToggle` function updates the component's state when a switch is toggled.
    - If the "Enable" switch is turned off, the corresponding "Required" state is also set to `false`.
- **Data Submission:**
    - In the `handleSaveChanges` function, the `jobData` payload was updated to include the four new fields, which are then sent to the server.

By following these steps, you can replicate this functionality for other fields in your application. This ensures a consistent implementation from the database to the user interface.

## 5. Database Query Fix (`server/storage.ts`)

A persistent "Failed to update job" error was traced back to a mismatch between the database schema and the SQL queries in the storage layer.

-   **Problem:** The `getJobsByCompany`, `getJobById`, `createJob`, and `updateJob` functions were attempting to select, insert, or update columns (`location`, `country`, `state`, `city`) that do not exist in the `jobs` table schema defined in `shared/schema.ts`. The schema correctly uses a single `locationId` to reference the `locations` table.
-   **Fix:** The SQL queries within these functions were corrected to remove references to the non-existent columns. All database operations for the `jobs` table now only use fields that are explicitly defined in the schema. This resolved the server-side error.

## 6. Implementing Conditional UI (`client/src/components/enhanced-application-form.tsx`)

To ensure job-specific application forms, features can be conditionally rendered based on settings configured for each job posting.

-   **Feature:** The "License Status" section on the public application form.
-   **Control Field:** The `showLicenseOptions` (boolean) field in the `jobs` table, which is controlled by a toggle in the "Edit Job" admin page.
-   **Implementation:** In the `enhanced-application-form.tsx` component, the entire JSX block for the "License Status" section is wrapped in a conditional check:
    ```jsx
    {job.showLicenseOptions && (
      // JSX for the license status section
    )}
    ```
-   **Result:** The license-related questions will only appear to candidates if the admin has explicitly enabled them for that specific job, and will be completely absent from the DOM otherwise.

## 7. Data Fetching for Job-Specific Features

For features like conditional phone fields or the license status section to work on the public-facing application form, the frontend must receive the correct settings from the backend.

-   **Problem:** The `showLicenseOptions` and `licenseStateName` fields were `undefined` in the `enhanced-application-form.tsx` component because the API was not supplying them.
-   **Fix:** The `getJobById` and `getJobByApplicationLink` functions in `server/storage.ts` were updated to `SELECT` the `show_license_options` and `license_state_name` columns from the `jobs` table.
-   **Result:** The frontend now receives all the necessary data to dynamically render the application form according to the settings configured for that specific job.

## 8. API Route Data Passthrough

The final link in the data chain is the API route that serves job data to the public application form.

-   **Problem:** Even after the database was correctly fetching the `showLicenseOptions` and `licenseStateName` fields, they were still `undefined` on the frontend. This was because the API routes (`/api/application/:link` and `/api/application/job/:jobId/:shortCode`) were manually constructing the JSON response and omitting these new fields.
-   **Fix:** The JSON objects returned by these routes in `server/routes.ts` were updated to include `showLicenseOptions: job.showLicenseOptions` and `licenseStateName: job.licenseStateName`.
-   **Result:** The API now passes the complete job settings to the frontend, ensuring the application form has all the information it needs to render correctly. This completes the data flow from database to UI.

## 9. Fixing a Page-Load Crash

A final bug was causing the application page to fail to load correctly, which made it seem as though API data was missing.

-   **Problem:** The `trackJobViewMutation` in `application-form.tsx` was being called without a `companyId`. Because the backend requires this field, the API call would fail with a 400 error, which would interrupt the page's rendering process and prevent the job data from being displayed.
-   **Fix:** The `companyId` was added to the mutation's payload. The component now passes `job.companyId` when it calls the mutation.
-   **Result:** The job view is now tracked successfully, the API call no longer fails, and the page loads and displays all the job data as expected. 