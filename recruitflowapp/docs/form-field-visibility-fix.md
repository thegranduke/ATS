# Form Field Visibility Fix

## Problem Description
The application form was not properly respecting the enable/disable settings for phone number and address fields. While the fields were being marked as required/optional based on the `requirePhone` and `requireAddress` settings, they were always being shown regardless of the `enablePhone` and `enableAddress` settings.

## Solution Overview
The solution involves modifying the `EnhancedApplicationForm` component to check both the enable and require settings before rendering fields. This ensures that:
1. Fields are only shown when enabled
2. Required fields are properly marked when shown
3. Disabled fields are completely hidden

## Technical Details

### Current Implementation
The form currently checks only the `require` flags:
```typescript
// Phone Number field
<div>
  <Label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
    Phone Number
  </Label>
  <Input
    {...form.register("phone")}
    type="tel"
    id="phone"
    placeholder="(123) 456-7890"
    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
  />
  {form.formState.errors.phone && (
    <p className="mt-1 text-sm text-red-600">{form.formState.errors.phone.message}</p>
  )}
</div>
```

### Required Changes
1. Add conditional rendering based on enable flags
2. Update form validation to only validate enabled fields
3. Ensure disabled fields are not included in form submission

## Benefits
1. **Proper Field Visibility**: Fields are only shown when enabled
2. **Cleaner Form**: Users only see fields that are relevant
3. **Accurate Validation**: Only enabled fields are validated
4. **Better UX**: Clearer form structure based on job requirements

## Testing
To verify the fix:
1. Edit a job's form settings
2. Disable phone number field
3. View the application form
4. Phone number field should be completely hidden
5. Repeat for address field
6. Verify that required fields are properly marked when enabled

## Future Considerations
1. Consider adding field dependencies (e.g., address required if phone is provided)
2. Add field grouping for better organization
3. Consider adding field descriptions when enabled
4. Add analytics for field usage 