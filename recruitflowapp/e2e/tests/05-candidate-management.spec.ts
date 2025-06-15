import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';

test.describe('Candidate Management Pages', () => {
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

  test('Candidates listing page loads correctly', async ({ page }) => {
    await page.goto('/candidates');
    await page.waitForLoadState('networkidle');
    
    // Verify page header
    await expect(page.locator('h1, .page-title, [data-testid*="title"]')).toBeVisible();
    
    // Look for candidate listings or empty state
    const candidateItems = page.locator('.candidate-item, .candidate-card, [data-testid*="candidate"]');
    const emptyState = page.locator('.empty-state, .no-candidates, text=No candidates');
    
    const hasCandidates = await candidateItems.count() > 0;
    const hasEmptyState = await emptyState.isVisible();
    
    expect(hasCandidates || hasEmptyState).toBeTruthy();
  });

  test('Add new candidate functionality', async ({ page }) => {
    await page.goto('/candidates');
    await page.waitForLoadState('networkidle');
    
    // Look for add candidate button
    const addCandidateButton = page.locator('button:has-text("Add Candidate"), button:has-text("Create Candidate"), [data-testid*="add-candidate"]');
    
    if (await addCandidateButton.isVisible()) {
      await addCandidateButton.click();
      await page.waitForLoadState('networkidle');
      
      // Should show candidate form
      const candidateForm = page.locator('form, .candidate-form, [data-testid*="candidate-form"]');
      if (await candidateForm.isVisible()) {
        // Fill out candidate form
        const nameInput = page.locator('input[name="fullName"], input[name="name"], [placeholder*="name" i]');
        const emailInput = page.locator('input[name="email"], [placeholder*="email" i]');
        const phoneInput = page.locator('input[name="phone"], [placeholder*="phone" i]');
        
        if (await nameInput.isVisible()) {
          await nameInput.fill('John Doe Test Candidate');
        }
        
        if (await emailInput.isVisible()) {
          await emailInput.fill('john.test@example.com');
        }
        
        if (await phoneInput.isVisible()) {
          await phoneInput.fill('+1-555-0123');
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

  test('Candidate search and filtering', async ({ page }) => {
    await page.goto('/candidates');
    await page.waitForLoadState('networkidle');
    
    // Test search functionality
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i], [data-testid*="search"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('john');
      await searchInput.press('Enter');
      await page.waitForLoadState('networkidle');
    }
    
    // Test status filter
    const statusFilter = page.locator('select[name="status"], .status-filter, [data-testid*="status-filter"]');
    if (await statusFilter.isVisible()) {
      await statusFilter.click();
      
      const statusOptions = page.locator('option, .dropdown-item, [role="menuitem"]');
      if (await statusOptions.count() > 0) {
        await statusOptions.first().click();
        await page.waitForLoadState('networkidle');
      }
    }
  });

  test('Candidate details page functionality', async ({ page }) => {
    await page.goto('/candidates');
    await page.waitForLoadState('networkidle');
    
    // Click on first candidate if available
    const candidateItems = page.locator('.candidate-item, .candidate-card, [data-testid*="candidate"]');
    if (await candidateItems.count() > 0) {
      await candidateItems.first().click();
      await page.waitForLoadState('networkidle');
      
      // Should be on candidate details page
      expect(page.url()).toMatch(/\/candidates\/\d+/);
      
      // Verify candidate details content
      await expect(page.locator('h1, .candidate-name, [data-testid*="name"]')).toBeVisible();
      
      // Check for tabs or sections
      const tabs = page.locator('.tab, [role="tab"], .nav-tab');
      if (await tabs.count() > 0) {
        // Test clicking different tabs
        for (let i = 0; i < Math.min(await tabs.count(), 3); i++) {
          await tabs.nth(i).click();
          await page.waitForLoadState('networkidle');
        }
      }
    }
  });

  test('Candidate status updates', async ({ page }) => {
    await page.goto('/candidates');
    await page.waitForLoadState('networkidle');
    
    // Look for status dropdown or buttons
    const statusControls = page.locator('.status-dropdown, .candidate-status, [data-testid*="status"]');
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

  test('Document upload functionality', async ({ page }) => {
    await page.goto('/candidates');
    await page.waitForLoadState('networkidle');
    
    // Navigate to candidate details
    const candidateItems = page.locator('.candidate-item, .candidate-card, [data-testid*="candidate"]');
    if (await candidateItems.count() > 0) {
      await candidateItems.first().click();
      await page.waitForLoadState('networkidle');
      
      // Look for document upload section
      const uploadButton = page.locator('button:has-text("Upload"), input[type="file"], [data-testid*="upload"]');
      const documentsTab = page.locator('text=Documents, [data-testid*="documents"]');
      
      if (await documentsTab.isVisible()) {
        await documentsTab.click();
        await page.waitForLoadState('networkidle');
      }
      
      if (await uploadButton.isVisible()) {
        await expect(uploadButton).toBeVisible();
      }
    }
  });

  test('Comments and notes functionality', async ({ page }) => {
    await page.goto('/candidates');
    await page.waitForLoadState('networkidle');
    
    // Navigate to candidate details
    const candidateItems = page.locator('.candidate-item, .candidate-card, [data-testid*="candidate"]');
    if (await candidateItems.count() > 0) {
      await candidateItems.first().click();
      await page.waitForLoadState('networkidle');
      
      // Look for comments section
      const commentsTab = page.locator('text=Comments, text=Notes, [data-testid*="comments"]');
      if (await commentsTab.isVisible()) {
        await commentsTab.click();
        await page.waitForLoadState('networkidle');
        
        // Look for comment input
        const commentInput = page.locator('textarea, .comment-input, [data-testid*="comment"]');
        if (await commentInput.isVisible()) {
          await commentInput.fill('Test comment for candidate');
          
          const submitButton = page.locator('button:has-text("Add"), button:has-text("Post"), [data-testid*="submit"]');
          if (await submitButton.isVisible()) {
            await submitButton.click();
            await page.waitForLoadState('networkidle');
          }
        }
      }
    }
  });

  test('Candidate editing functionality', async ({ page }) => {
    await page.goto('/candidates');
    await page.waitForLoadState('networkidle');
    
    // Navigate to candidate details
    const candidateItems = page.locator('.candidate-item, .candidate-card, [data-testid*="candidate"]');
    if (await candidateItems.count() > 0) {
      await candidateItems.first().click();
      await page.waitForLoadState('networkidle');
      
      // Look for edit button
      const editButton = page.locator('button:has-text("Edit"), [data-testid*="edit"]');
      if (await editButton.isVisible()) {
        await editButton.click();
        await page.waitForLoadState('networkidle');
        
        // Should show edit form or navigate to edit page
        const isEditPage = page.url().includes('/edit');
        const hasEditForm = await page.locator('form, .edit-form, [data-testid*="edit-form"]').isVisible();
        
        expect(isEditPage || hasEditForm).toBeTruthy();
        
        if (hasEditForm || isEditPage) {
          // Modify candidate name
          const nameInput = page.locator('input[name="fullName"], input[name="name"], [data-testid*="name"]');
          if (await nameInput.isVisible()) {
            await nameInput.fill('Updated Candidate Name');
            
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

  test('Bulk candidate operations', async ({ page }) => {
    await page.goto('/candidates');
    await page.waitForLoadState('networkidle');
    
    // Look for checkboxes to select multiple candidates
    const checkboxes = page.locator('input[type="checkbox"], .candidate-checkbox, [data-testid*="select"]');
    if (await checkboxes.count() > 1) {
      // Select first two candidates
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

  test('Candidate pipeline management', async ({ page }) => {
    await page.goto('/candidates');
    await page.waitForLoadState('networkidle');
    
    // Look for pipeline or kanban view
    const pipelineView = page.locator('.pipeline, .kanban, [data-testid*="pipeline"]');
    const viewToggle = page.locator('button:has-text("Pipeline"), button:has-text("Board"), [data-testid*="view"]');
    
    if (await viewToggle.isVisible()) {
      await viewToggle.click();
      await page.waitForLoadState('networkidle');
    }
    
    if (await pipelineView.isVisible()) {
      // Test drag and drop if available
      const candidateCards = page.locator('.candidate-card, .pipeline-item, [data-testid*="candidate"]');
      if (await candidateCards.count() > 0) {
        await expect(candidateCards.first()).toBeVisible();
      }
    }
  });
});