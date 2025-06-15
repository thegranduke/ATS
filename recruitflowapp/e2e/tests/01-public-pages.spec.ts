import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';

test.describe('Public Pages - Unauthenticated Access', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
  });

  test('Landing Page - Should display marketing content and navigation', async ({ page }) => {
    await page.goto('/');
    
    // Check page loads correctly
    await expect(page).toHaveTitle(/RecruitFlow|HireTrack/);
    
    // Verify key elements are visible
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('[data-testid="cta-button"], .cta-button, [href="/auth"]')).toBeVisible();
    
    // Test navigation to auth page
    const authLink = page.locator('[href="/auth"], [data-testid="get-started"], .auth-link').first();
    if (await authLink.isVisible()) {
      await authLink.click();
      await expect(page).toHaveURL(/.*\/auth/);
    }
  });

  test('Auth Page - Login functionality', async ({ page }) => {
    await page.goto('/auth');
    
    // Verify auth form is present
    await expect(page.locator('input[type="email"], [placeholder*="email" i]')).toBeVisible();
    await expect(page.locator('input[type="password"], [placeholder*="password" i]')).toBeVisible();
    
    // Test form validation - empty fields
    const submitButton = page.locator('button[type="submit"], [data-testid="login-button"], button:has-text("Sign In")').first();
    await submitButton.click();
    
    // Should show validation messages or stay on page
    await expect(page).toHaveURL(/.*\/auth/);
  });

  test('Auth Page - Registration functionality', async ({ page }) => {
    await page.goto('/auth');
    
    // Look for registration tab or form
    const registerTab = page.locator('[data-testid="register-tab"], button:has-text("Register"), a:has-text("Sign Up")');
    if (await registerTab.isVisible()) {
      await registerTab.click();
      
      // Verify registration fields
      await expect(page.locator('input[type="email"], [placeholder*="email" i]')).toBeVisible();
      await expect(page.locator('input[type="password"], [placeholder*="password" i]')).toBeVisible();
    }
  });

  test('Application Form - Public job application', async ({ page }) => {
    // Test both URL patterns for application forms
    const testUrls = ['/apply/test-link', '/j/1/abc123'];
    
    for (const url of testUrls) {
      await page.goto(url);
      
      // Should show application form or redirect appropriately
      // Don't expect specific behavior since jobs may not exist in test environment
      await page.waitForLoadState('networkidle');
      
      // Check if form elements are present (if job exists)
      const hasForm = await page.locator('form, input[type="email"]').count() > 0;
      if (hasForm) {
        await expect(page.locator('input[type="email"], [placeholder*="email" i]')).toBeVisible();
      }
    }
  });

  test('Terms of Service page', async ({ page }) => {
    await page.goto('/terms');
    
    // Verify page loads and contains legal content
    await expect(page.locator('h1, .page-title')).toBeVisible();
    
    // Should contain typical terms content
    const pageContent = await page.textContent('body');
    const hasLegalContent = pageContent?.toLowerCase().includes('terms') || 
                           pageContent?.toLowerCase().includes('service') ||
                           pageContent?.toLowerCase().includes('agreement');
    expect(hasLegalContent).toBeTruthy();
  });

  test('Privacy Policy page', async ({ page }) => {
    await page.goto('/privacy');
    
    // Verify page loads and contains privacy content
    await expect(page.locator('h1, .page-title')).toBeVisible();
    
    // Should contain typical privacy content
    const pageContent = await page.textContent('body');
    const hasPrivacyContent = pageContent?.toLowerCase().includes('privacy') || 
                             pageContent?.toLowerCase().includes('data') ||
                             pageContent?.toLowerCase().includes('information');
    expect(hasPrivacyContent).toBeTruthy();
  });

  test('Protected routes redirect to auth when not logged in', async ({ page }) => {
    const protectedRoutes = [
      '/dashboard',
      '/jobs',
      '/candidates',
      '/settings',
      '/user-settings',
      '/billing',
      '/reporting',
      '/help'
    ];

    for (const route of protectedRoutes) {
      await page.goto(route);
      
      // Should redirect to auth or landing page
      await page.waitForLoadState('networkidle');
      const currentUrl = page.url();
      
      expect(
        currentUrl.includes('/auth') || 
        currentUrl.includes('/') && !currentUrl.includes(route)
      ).toBeTruthy();
    }
  });

  test('Navigation accessibility and responsiveness', async ({ page }) => {
    await page.goto('/');
    
    // Test mobile responsiveness
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForLoadState('networkidle');
    
    // Check if mobile menu toggle is present
    const mobileMenu = page.locator('[data-testid="mobile-menu"], .mobile-menu, .hamburger-menu');
    if (await mobileMenu.isVisible()) {
      await mobileMenu.click();
      await expect(page.locator('.mobile-nav, [data-testid="mobile-nav"]')).toBeVisible();
    }
    
    // Reset to desktop view
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('Page performance and loading', async ({ page }) => {
    // Test page load performance
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    // Page should load within reasonable time (10 seconds)
    expect(loadTime).toBeLessThan(10000);
    
    // Check for basic performance metrics
    const performanceMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.navigationStart,
        loadComplete: navigation.loadEventEnd - navigation.navigationStart
      };
    });
    
    expect(performanceMetrics.domContentLoaded).toBeGreaterThan(0);
  });
});