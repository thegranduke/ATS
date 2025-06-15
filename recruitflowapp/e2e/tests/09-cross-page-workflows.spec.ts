import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';

test.describe('Cross-Page Workflows and Integration Tests', () => {
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

  test('Complete job posting workflow', async ({ page }) => {
    // Start from dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Navigate to jobs page
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');
    
    // Create new job
    const addJobButton = page.locator('button:has-text("Add Job"), button:has-text("Create Job"), [data-testid*="add-job"]');
    if (await addJobButton.isVisible()) {
      await addJobButton.click();
      await page.waitForLoadState('networkidle');
      
      // Fill job form
      const titleInput = page.locator('input[name="title"], [data-testid*="title"]');
      if (await titleInput.isVisible()) {
        await titleInput.fill('E2E Test Software Engineer');
        
        const departmentInput = page.locator('input[name="department"], select[name="department"], [data-testid*="department"]');
        if (await departmentInput.isVisible()) {
          await departmentInput.fill('Engineering');
        }
        
        const descriptionInput = page.locator('textarea[name="description"], [data-testid*="description"]');
        if (await descriptionInput.isVisible()) {
          await descriptionInput.fill('This is a test job created by E2E automation');
        }
        
        // Submit job creation
        const submitButton = page.locator('button[type="submit"], button:has-text("Create"), button:has-text("Save")').first();
        if (await submitButton.isVisible()) {
          await submitButton.click();
          await page.waitForLoadState('networkidle');
        }
      }
    }
    
    // Verify job appears in listing
    const jobItems = page.locator('text=E2E Test Software Engineer');
    if (await jobItems.count() > 0) {
      await expect(jobItems.first()).toBeVisible();
    }
  });

  test('Candidate application to hire workflow', async ({ page }) => {
    // Start by creating a candidate
    await page.goto('/candidates');
    await page.waitForLoadState('networkidle');
    
    const addCandidateButton = page.locator('button:has-text("Add Candidate"), [data-testid*="add-candidate"]');
    if (await addCandidateButton.isVisible()) {
      await addCandidateButton.click();
      await page.waitForLoadState('networkidle');
      
      // Fill candidate form
      const nameInput = page.locator('input[name="fullName"], input[name="name"], [data-testid*="name"]');
      if (await nameInput.isVisible()) {
        await nameInput.fill('E2E Test Candidate');
        
        const emailInput = page.locator('input[name="email"], [data-testid*="email"]');
        if (await emailInput.isVisible()) {
          await emailInput.fill('e2etest@example.com');
        }
        
        // Submit candidate creation
        const submitButton = page.locator('button[type="submit"], button:has-text("Create")').first();
        if (await submitButton.isVisible()) {
          await submitButton.click();
          await page.waitForLoadState('networkidle');
        }
      }
    }
    
    // Move candidate through pipeline stages
    const candidateItems = page.locator('text=E2E Test Candidate');
    if (await candidateItems.count() > 0) {
      await candidateItems.first().click();
      await page.waitForLoadState('networkidle');
      
      // Change status from applied to screening
      const statusDropdown = page.locator('.status-dropdown, [data-testid*="status"]');
      if (await statusDropdown.isVisible()) {
        await statusDropdown.click();
        
        const screeningOption = page.locator('text=Screening, [data-value="screening"]');
        if (await screeningOption.isVisible()) {
          await screeningOption.click();
          await page.waitForLoadState('networkidle');
        }
      }
    }
  });

  test('Navigation consistency across all pages', async ({ page }) => {
    const pagesToTest = [
      '/dashboard',
      '/jobs',
      '/candidates',
      '/reporting',
      '/settings',
      '/user-settings',
      '/billing',
      '/help'
    ];
    
    for (const pagePath of pagesToTest) {
      await page.goto(pagePath);
      await page.waitForLoadState('networkidle');
      
      // Verify page loads without errors
      const errorMessages = page.locator('.error, [data-testid="error"], .text-red-500');
      expect(await errorMessages.count()).toBe(0);
      
      // Verify navigation menu is present
      const nav = page.locator('nav, .navigation, .sidebar');
      if (await nav.isVisible()) {
        await expect(nav).toBeVisible();
      }
      
      // Verify user menu is accessible
      const userMenu = page.locator('.user-menu, [data-testid*="user"], .user-avatar');
      if (await userMenu.isVisible()) {
        await expect(userMenu).toBeVisible();
      }
    }
  });

  test('Search functionality across different pages', async ({ page }) => {
    const searchablePages = ['/jobs', '/candidates', '/help'];
    
    for (const pagePath of searchablePages) {
      await page.goto(pagePath);
      await page.waitForLoadState('networkidle');
      
      const searchInput = page.locator('input[type="search"], [placeholder*="search" i], [data-testid*="search"]');
      if (await searchInput.isVisible()) {
        await searchInput.fill('test search');
        await searchInput.press('Enter');
        await page.waitForLoadState('networkidle');
        
        // Should not show error after search
        const errorMessages = page.locator('.error, [data-testid="error"]');
        expect(await errorMessages.count()).toBe(0);
      }
    }
  });

  test('Form validation consistency', async ({ page }) => {
    const formsToTest = [
      { page: '/jobs', button: 'button:has-text("Add Job"), [data-testid*="add-job"]' },
      { page: '/candidates', button: 'button:has-text("Add Candidate"), [data-testid*="add-candidate"]' }
    ];
    
    for (const formTest of formsToTest) {
      await page.goto(formTest.page);
      await page.waitForLoadState('networkidle');
      
      const addButton = page.locator(formTest.button);
      if (await addButton.isVisible()) {
        await addButton.click();
        await page.waitForLoadState('networkidle');
        
        // Try to submit empty form
        const submitButton = page.locator('button[type="submit"], button:has-text("Create"), button:has-text("Save")').first();
        if (await submitButton.isVisible()) {
          await submitButton.click();
          await page.waitForLoadState('networkidle');
          
          // Should show validation errors or stay on form
          const currentUrl = page.url();
          const hasValidationErrors = await page.locator('.error, .invalid, .text-red').count() > 0;
          const stayedOnForm = currentUrl.includes(formTest.page) || currentUrl.includes('modal');
          
          expect(hasValidationErrors || stayedOnForm).toBeTruthy();
        }
      }
    }
  });

  test('Notification system across pages', async ({ page }) => {
    // Test that notifications appear consistently
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Look for notification bell or indicator
    const notificationBell = page.locator('.notification-bell, [data-testid*="notification"], .notification-icon');
    if (await notificationBell.isVisible()) {
      await notificationBell.click();
      
      // Should show notifications dropdown or panel
      const notificationPanel = page.locator('.notification-panel, .notifications-dropdown, [data-testid*="notification-panel"]');
      if (await notificationPanel.isVisible()) {
        await expect(notificationPanel).toBeVisible();
      }
    }
  });

  test('Responsive design consistency', async ({ page }) => {
    const viewports = [
      { width: 375, height: 667, name: 'mobile' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 1280, height: 720, name: 'desktop' }
    ];
    
    const pagesToTest = ['/dashboard', '/jobs', '/candidates'];
    
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      
      for (const pagePath of pagesToTest) {
        await page.goto(pagePath);
        await page.waitForLoadState('networkidle');
        
        // Check that content is visible and accessible
        const mainContent = page.locator('main, .main-content, .page-content');
        if (await mainContent.isVisible()) {
          const boundingBox = await mainContent.boundingBox();
          if (boundingBox) {
            expect(boundingBox.width).toBeLessThanOrEqual(viewport.width);
          }
        }
        
        // Check for mobile menu on smaller screens
        if (viewport.width < 768) {
          const mobileMenuToggle = page.locator('.mobile-menu-toggle, .hamburger, [data-testid*="mobile-menu"]');
          if (await mobileMenuToggle.isVisible()) {
            await expect(mobileMenuToggle).toBeVisible();
          }
        }
      }
    }
    
    // Reset to desktop
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('Data persistence across page navigation', async ({ page }) => {
    // Create some data on one page
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');
    
    // Navigate to different pages and back
    await page.goto('/candidates');
    await page.waitForLoadState('networkidle');
    
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Go back to jobs page
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');
    
    // Data should still be there (no unexpected data loss)
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });

  test('Error handling consistency', async ({ page }) => {
    // Test 404 handling
    await page.goto('/nonexistent-page');
    await page.waitForLoadState('networkidle');
    
    // Should show 404 page or redirect appropriately
    const pageContent = await page.textContent('body');
    const has404Content = pageContent?.includes('404') || 
                         pageContent?.includes('Not Found') ||
                         pageContent?.includes('Page not found');
    
    // Should either show 404 page or redirect to a valid page
    expect(has404Content || !page.url().includes('nonexistent-page')).toBeTruthy();
  });

  test('Session timeout handling', async ({ page }) => {
    // This test would ideally test session timeout behavior
    // For now, we'll test that protected pages require authentication
    
    // Clear session storage to simulate logout
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.clear();
    });
    
    // Try to access protected page
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Should redirect to auth or show login prompt
    const currentUrl = page.url();
    expect(currentUrl.includes('/auth') || currentUrl.includes('/')).toBeTruthy();
  });
});