# Form Field API Persistence Fix

## Problem
The application form was not correctly displaying the phone and address fields because the API endpoints that fetch job data were not including the `enablePhone`, `requirePhone`, `enableAddress`, and `requireAddress` fields in their responses. As a result, these fields were undefined in the frontend, causing the form to not show the fields even when they were enabled.

## Solution
We updated the SQL queries in three methods in the `DatabaseStorage` class to include the form field settings:

1. `getJobByApplicationLink`
2. `getJobById`
3. `getJobsByCompany`

Each method now includes the following fields in their SELECT statements:
- `enable_phone as "enablePhone"`
- `require_phone as "requirePhone"`
- `enable_address as "enableAddress"`
- `require_address as "requireAddress"`

## Files Changed
- `recruitflowapp/server/storage.ts`

## Code Examples
Before:
```sql
SELECT 
  j.id,
  j.title,
  -- ... other fields ...
  j.created_at as "createdAt"
FROM jobs j
WHERE j.application_link = $1
```

After:
```sql
SELECT 
  j.id,
  j.title,
  -- ... other fields ...
  j.created_at as "createdAt",
  j.enable_phone as "enablePhone",
  j.require_phone as "requirePhone",
  j.enable_address as "enableAddress",
  j.require_address as "requireAddress"
FROM jobs j
WHERE j.application_link = $1
```

## Testing Instructions
1. Edit a job's form settings to enable/disable phone and address fields
2. Save the changes
3. View the application form for that job
4. Verify that the phone and address fields appear/disappear according to the settings
5. Refresh the page and verify that the settings persist

## Benefits
- Form fields now correctly reflect the job's settings
- Settings persist across page reloads
- Consistent behavior across all job-related API endpoints 