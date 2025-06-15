# Form Settings Persistence Fix

## Problem Description
The job application form settings (phone number and address enable/require toggles) were being stored in localStorage instead of the database. This caused two main issues:
1. Settings were lost when clearing browser data
2. Settings weren't synchronized across different browsers/devices
3. Settings weren't properly persisted between page reloads

## Solution Overview
The solution involved moving the form settings storage from localStorage to the database. This ensures:
- Persistent storage across all devices
- Proper data synchronization
- Consistent behavior between page reloads

## Technical Details

### Database Schema
The database already had the necessary fields in the `jobs` table:
```typescript
requirePhone: boolean("require_phone").default(false),
enablePhone: boolean("enable_phone").default(true),
requireAddress: boolean("require_address").default(false),
enableAddress: boolean("enable_address").default(true),
requireResume: boolean("require_resume").default(true),
```

### Changes Made

#### 1. Removed localStorage Operations
Removed the following code from `handleSaveChanges`:
```typescript
// Removed localStorage saving
const formSettings = {
  requireFirstName: formData.requireFirstName,
  requireLastName: formData.requireLastName,
  requireEmail: formData.requireEmail,
  requirePhone: formData.requirePhone,
  enablePhone: formData.enablePhone,
  requireAddress: formData.requireAddress,
  enableAddress: formData.enableAddress,
  requireResume: formData.requireResume
};
localStorage.setItem(`job_form_settings_${id}`, JSON.stringify(formSettings));
```

#### 2. Removed localStorage Loading
Removed the following code from the `useEffect` hook:
```typescript
// Removed localStorage loading
try {
  const savedFormSettings = localStorage.getItem(`job_form_settings_${id}`);
  if (savedFormSettings) {
    const parsedSettings = JSON.parse(savedFormSettings);
    Object.assign(newFormData, parsedSettings);
  } else {
    // Default values logic removed
  }
} catch (error) {
  // Error handling removed
}
```

#### 3. Added Form Settings to API Payload
Added form settings to the job data sent to the API in `handleSaveChanges`:
```typescript
const jobData: JobFormValues = {
  // ... existing job fields ...
  requirePhone: formData.requirePhone,
  enablePhone: formData.enablePhone,
  requireAddress: formData.requireAddress,
  enableAddress: formData.enableAddress,
  requireResume: formData.requireResume
};
```

## Benefits
1. **Data Persistence**: Form settings are now stored in the database
2. **Cross-device Consistency**: Settings are synchronized across all devices
3. **Better Data Management**: Settings are part of the job data model
4. **Improved Reliability**: No dependency on browser storage

## Testing
To verify the fix:
1. Edit a job's form settings (enable/require phone and address)
2. Save the changes
3. Refresh the page
4. The settings should persist
5. Test on different browsers/devices to confirm synchronization

## Future Considerations
1. Consider adding form settings to the job creation flow
2. Add validation for form settings
3. Consider adding a way to copy form settings between jobs
4. Add analytics for form field usage 