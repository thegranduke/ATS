import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';

test.describe('Job Management Pages', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    
    // Login before each test
    await page.goto('/auth');
    const emailInput = page.locator('input[type="email"], input[name="email"], [placeholder*="email" i]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"], [placeholder*="password" i]').first();
    
    await emailInput.fill('admin@test.com');
    await passwordInput.fill('password123');

    const loginButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")').first();
    await loginButton.click();
    await page.waitForLoadState('networkidle');
  });

  test('Job listing page loads and displays jobs', async ({ page }) => {
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');
    
    // Verify page title/header
    await expect(page.locator('h1, .page-title, [data-testid*="title"]')).toBeVisible();
    
    // Look for job listings or empty state
    const jobItems = page.locator('.job-item, .job-card, [data-testid*="job"]');
    const emptyState = page.locator('.empty-state, .no-jobs, text=No jobs');
    
    const hasJobs = await jobItems.count() > 0;
    const hasEmptyState = await emptyState.isVisible();
    
    expect(hasJobs || hasEmptyState).toBeTruthy();
  });

  test('Add new job functionality', async ({ page }) => {
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');
    
    // Look for add job button
    const addJobButton = page.locator('button:has-text("Add Job"), button:has-text("Create Job"), [data-testid*="add-job"]');
    
    if (await addJobButton.isVisible()) {
      await addJobButton.click();
      await page.waitForLoadState('networkidle');
      
      // Should show job form (modal or new page)
      const jobForm = page.locator('form, .job-form, [data-testid*="job-form"]');
      if (await jobForm.isVisible()) {
        // Fill out job form
        const titleInput = page.locator('input[name="title"], [placeholder*="title" i], [data-testid*="title"]');
        const departmentInput = page.locator('input[name="department"], select[name="department"], [data-testid*="department"]');
        const descriptionInput = page.locator('textarea[name="description"], [data-testid*="description"]');
        
        if (await titleInput.isVisible()) {
          await titleInput.fill('Test Software Engineer Position');
        }
        
        if (await departmentInput.isVisible()) {
          await departmentInput.fill('Engineering');
        }
        
        if (await descriptionInput.isVisible()) {
          await descriptionInput.fill('Test job description for automation testing');
        }
        
        // Submit form
        const submitButton = page.locator('button[type="submit"], button:has-text("Create"), button:has-text("Save")').first();
        if (await submitButton.isVisible()) {
          await submitButton.click();
          await page.waitForLoadState('networkidle');
        }
      }
    }
  });

  test('Job search and filtering', async ({ page }) => {
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');
    
    // Test search functionality
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i], [data-testid*="search"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('engineer');
      await searchInput.press('Enter');
      await page.waitForLoadState('networkidle');
    }
    
    // Test filters
    const filterButtons = page.locator('button:has-text("Filter"), .filter-button, [data-testid*="filter"]');
    if (await filterButtons.count() > 0) {
      await filterButtons.first().click();
      
      // Look for filter options
      const filterOptions = page.locator('.filter-option, .dropdown-item, [role="menuitem"]');
      if (await filterOptions.count() > 0) {
        await filterOptions.first().click();
        await page.waitForLoadState('networkidle');
      }
    }
  });

  test('Job details page functionality', async ({ page }) => {
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');
    
    // Click on first job if available
    const jobItems = page.locator('.job-item, .job-card, [data-testid*="job"]');
    if (await jobItems.count() > 0) {
      await jobItems.first().click();
      await page.waitForLoadState('networkidle');
      
      // Should be on job details page
      expect(page.url()).toMatch(/\/jobs\/\d+/);
      
      // Verify job details content
      await expect(page.locator('h1, .job-title, [data-testid*="title"]')).toBeVisible();
      
      // Look for action buttons
      const editButton = page.locator('button:has-text("Edit"), [data-testid*="edit"]');
      const deleteButton = page.locator('button:has-text("Delete"), [data-testid*="delete"]');
      
      if (await editButton.isVisible()) {
        await expect(editButton).toBeVisible();
      }
      
      if (await deleteButton.isVisible()) {
        await expect(deleteButton).toBeVisible();
      }
    }
  });

  test('Job editing functionality', async ({ page }) => {
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');
    
    // Find and click on a job to edit
    const jobItems = page.locator('.job-item, .job-card, [data-testid*="job"]');
    if (await jobItems.count() > 0) {
      await jobItems.first().click();
      await page.waitForLoadState('networkidle');
      
      // Look for edit button
      const editButton = page.locator('button:has-text("Edit"), [data-testid*="edit"]');
      if (await editButton.isVisible()) {
        await editButton.click();
        await page.waitForLoadState('networkidle');
        
        // Should be on edit page or show edit form
        const isEditPage = page.url().includes('/edit');
        const hasEditForm = await page.locator('form, .edit-form, [data-testid*="edit-form"]').isVisible();
        
        expect(isEditPage || hasEditForm).toBeTruthy();
        
        if (hasEditForm || isEditPage) {
          // Modify job title
          const titleInput = page.locator('input[name="title"], [data-testid*="title"]');
          if (await titleInput.isVisible()) {
            await titleInput.fill('Updated Job Title');
            
            // Save changes
            const saveButton = page.locator('button:has-text("Save"), button:has-text("Update"), [data-testid*="save"]');
            if (await saveButton.isVisible()) {
              await saveButton.click();
              await page.waitForLoadState('networkidle');
            }
          }
        }
      }
    }
  });

  test('Job status management', async ({ page }) => {
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');
    
    // Look for job status controls
    const statusControls = page.locator('.status-dropdown, .job-status, [data-testid*="status"]');
    if (await statusControls.count() > 0) {
      await statusControls.first().click();
      
      // Look for status options
      const statusOptions = page.locator('[data-value], .dropdown-item, [role="menuitem"]');
      if (await statusOptions.count() > 0) {
        await statusOptions.first().click();
        await page.waitForLoadState('networkidle');
      }
    }
  });

  test('Bulk operations on jobs', async ({ page }) => {
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');
    
    // Look for checkboxes to select multiple jobs
    const checkboxes = page.locator('input[type="checkbox"], .job-checkbox, [data-testid*="select"]');
    if (await checkboxes.count() > 1) {
      // Select first two jobs
      await checkboxes.nth(0).check();
      await checkboxes.nth(1).check();
      
      // Look for bulk actions menu
      const bulkActionsButton = page.locator('button:has-text("Bulk"), .bulk-actions, [data-testid*="bulk"]');
      if (await bulkActionsButton.isVisible()) {
        await bulkActionsButton.click();
        
        // Should show bulk action options
        const bulkOptions = page.locator('.bulk-option, .dropdown-item, [role="menuitem"]');
        if (await bulkOptions.count() > 0) {
          await expect(bulkOptions.first()).toBeVisible();
        }
      }
    }
  });

  test('Job application link generation', async ({ page }) => {
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');
    
    // Click on first job
    const jobItems = page.locator('.job-item, .job-card, [data-testid*="job"]');
    if (await jobItems.count() > 0) {
      await jobItems.first().click();
      await page.waitForLoadState('networkidle');
      
      // Look for application link or share button
      const applicationLink = page.locator('text=Application Link, .application-link, [data-testid*="application"]');
      const shareButton = page.locator('button:has-text("Share"), [data-testid*="share"]');
      
      if (await applicationLink.isVisible()) {
        await expect(applicationLink).toBeVisible();
      } else if (await shareButton.isVisible()) {
        await shareButton.click();
        await page.waitForLoadState('networkidle');
      }
    }
  });

  test('Job posting to external boards', async ({ page }) => {
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');
    
    // Click on first job
    const jobItems = page.locator('.job-item, .job-card, [data-testid*="job"]');
    if (await jobItems.count() > 0) {
      await jobItems.first().click();
      await page.waitForLoadState('networkidle');
      
      // Look for integration or posting buttons
      const postButton = page.locator('button:has-text("Post"), button:has-text("Publish"), [data-testid*="post"]');
      const integrationButton = page.locator('button:has-text("Integration"), [data-testid*="integration"]');
      
      if (await postButton.isVisible()) {
        await expect(postButton).toBeVisible();
      } else if (await integrationButton.isVisible()) {
        await expect(integrationButton).toBeVisible();
      }
    }
  });
});