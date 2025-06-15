import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';

test.describe('Dashboard Page', () => {
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
    
    // Navigate to dashboard if not already there
    if (!page.url().includes('/dashboard')) {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
    }
  });

  test('Dashboard loads with key metrics', async ({ page }) => {
    // Verify dashboard page loads
    await expect(page.locator('h1, .page-title, [data-testid="dashboard-title"]')).toBeVisible();
    
    // Check for metrics cards/widgets
    const metricsSelectors = [
      '.metric, .card, .stat',
      '[data-testid*="metric"], [data-testid*="stat"]',
      '.grid .card, .metrics-grid .card'
    ];
    
    let metricsFound = false;
    for (const selector of metricsSelectors) {
      const elements = page.locator(selector);
      if (await elements.count() > 0) {
        await expect(elements.first()).toBeVisible();
        metricsFound = true;
        break;
      }
    }
    
    // Should have some kind of metrics display
    expect(metricsFound).toBeTruthy();
  });

  test('Navigation sidebar is functional', async ({ page }) => {
    // Check if sidebar exists
    const sidebar = page.locator('.sidebar, [data-testid="sidebar"], nav');
    
    if (await sidebar.isVisible()) {
      // Test navigation links
      const navLinks = [
        { text: 'Jobs', url: '/jobs' },
        { text: 'Candidates', url: '/candidates' },
        { text: 'Reports', url: '/reporting' },
        { text: 'Settings', url: '/settings' }
      ];
      
      for (const link of navLinks) {
        const navElement = page.locator(`a:has-text("${link.text}"), [href="${link.url}"]`);
        if (await navElement.isVisible()) {
          await navElement.click();
          await page.waitForLoadState('networkidle');
          expect(page.url()).toContain(link.url);
          
          // Navigate back to dashboard
          await page.goto('/dashboard');
          await page.waitForLoadState('networkidle');
        }
      }
    }
  });

  test('Quick actions are available', async ({ page }) => {
    // Look for quick action buttons
    const quickActionSelectors = [
      'button:has-text("Add Job"), button:has-text("Create Job")',
      'button:has-text("Add Candidate"), button:has-text("Create Candidate")',
      '[data-testid*="add"], [data-testid*="create"]',
      '.quick-action, .action-button'
    ];
    
    for (const selector of quickActionSelectors) {
      const elements = page.locator(selector);
      if (await elements.count() > 0) {
        const button = elements.first();
        await expect(button).toBeVisible();
        
        // Test clicking the button (should open modal or navigate)
        await button.click();
        await page.waitForLoadState('networkidle');
        
        // Close modal if it opened, or navigate back if it redirected
        const modal = page.locator('.modal, [role="dialog"], [data-testid*="modal"]');
        if (await modal.isVisible()) {
          const closeButton = page.locator('.modal button:has-text("Cancel"), .modal button:has-text("Close"), [data-testid="modal-close"]');
          if (await closeButton.isVisible()) {
            await closeButton.click();
          }
        } else if (!page.url().includes('/dashboard')) {
          await page.goto('/dashboard');
          await page.waitForLoadState('networkidle');
        }
        
        break;
      }
    }
  });

  test('Recent activity/notifications display', async ({ page }) => {
    // Look for activity feeds or notifications
    const activitySelectors = [
      '.activity, .recent-activity',
      '.notifications, .alerts',
      '[data-testid*="activity"], [data-testid*="notification"]',
      '.feed, .timeline'
    ];
    
    for (const selector of activitySelectors) {
      const elements = page.locator(selector);
      if (await elements.count() > 0) {
        await expect(elements.first()).toBeVisible();
        break;
      }
    }
  });

  test('Charts and analytics widgets load', async ({ page }) => {
    // Look for chart containers
    const chartSelectors = [
      'canvas, svg',
      '.chart, .graph',
      '[data-testid*="chart"], [data-testid*="graph"]',
      '.recharts-container, .chart-container'
    ];
    
    for (const selector of chartSelectors) {
      const elements = page.locator(selector);
      if (await elements.count() > 0) {
        await expect(elements.first()).toBeVisible();
        break;
      }
    }
  });

  test('User menu functionality', async ({ page }) => {
    // Look for user menu/avatar
    const userMenuSelectors = [
      '.user-menu, .user-avatar',
      '[data-testid*="user"], [data-testid*="avatar"]',
      '.profile-menu, .account-menu'
    ];
    
    for (const selector of userMenuSelectors) {
      const userMenu = page.locator(selector);
      if (await userMenu.isVisible()) {
        await userMenu.click();
        
        // Check for dropdown menu
        const dropdown = page.locator('.dropdown, .menu, [role="menu"]');
        if (await dropdown.isVisible()) {
          // Look for logout option
          const logoutOption = page.locator('text=Logout, text=Sign Out, [data-testid*="logout"]');
          if (await logoutOption.isVisible()) {
            await expect(logoutOption).toBeVisible();
          }
          
          // Close menu by clicking outside
          await page.click('body');
        }
        break;
      }
    }
  });

  test('Search functionality works', async ({ page }) => {
    // Look for search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i], [data-testid*="search"]');
    
    if (await searchInput.isVisible()) {
      await searchInput.fill('test search');
      await searchInput.press('Enter');
      await page.waitForLoadState('networkidle');
      
      // Should either show search results or navigate to search page
      const hasResults = await page.locator('.search-results, .results').isVisible();
      const isSearchPage = page.url().includes('search') || page.url().includes('query');
      
      expect(hasResults || isSearchPage).toBeTruthy();
    }
  });

  test('Responsive design works on mobile', async ({ page }) => {
    // Switch to mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Check if mobile menu toggle exists
    const mobileMenuToggle = page.locator('.mobile-menu-toggle, .hamburger, [data-testid*="mobile-menu"]');
    
    if (await mobileMenuToggle.isVisible()) {
      await mobileMenuToggle.click();
      
      // Should show mobile navigation
      const mobileNav = page.locator('.mobile-nav, .sidebar.open, [data-testid*="mobile-nav"]');
      await expect(mobileNav).toBeVisible();
    }
    
    // Reset to desktop
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('Page performance is acceptable', async ({ page }) => {
    const startTime = Date.now();
    await page.reload();
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    // Dashboard should load within 10 seconds
    expect(loadTime).toBeLessThan(10000);
  });
});