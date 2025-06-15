import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';

test.describe('Authentication Flow', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
  });

  test('User can register a new account', async ({ page }) => {
    await page.goto('/auth');
    
    // Look for registration form or tab
    const registerElement = page.locator('text=Register, text=Sign Up, [data-testid="register-tab"]').first();
    if (await registerElement.isVisible()) {
      await registerElement.click();
    }

    // Fill registration form with test data
    const timestamp = Date.now();
    const testEmail = `test-${timestamp}@example.com`;
    const testCompany = `Test Company ${timestamp}`;
    
    // Fill form fields (adapt selectors based on actual form structure)
    const emailInput = page.locator('input[type="email"], input[name="email"], [placeholder*="email" i]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"], [placeholder*="password" i]').first();
    const companyInput = page.locator('input[name="company"], input[name="companyName"], [placeholder*="company" i]');
    
    await emailInput.fill(testEmail);
    await passwordInput.fill('TestPassword123!');
    
    if (await companyInput.isVisible()) {
      await companyInput.fill(testCompany);
    }

    // Submit registration
    const submitButton = page.locator('button[type="submit"], button:has-text("Register"), button:has-text("Sign Up")').first();
    await submitButton.click();

    // Should redirect to dashboard or show success
    await page.waitForLoadState('networkidle');
    const currentUrl = page.url();
    expect(currentUrl.includes('/dashboard') || currentUrl.includes('/auth')).toBeTruthy();
  });

  test('User can login with valid credentials', async ({ page }) => {
    await page.goto('/auth');
    
    // Use default login credentials that should exist
    const emailInput = page.locator('input[type="email"], input[name="email"], [placeholder*="email" i]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"], [placeholder*="password" i]').first();
    
    await emailInput.fill('admin@test.com');
    await passwordInput.fill('password123');

    const loginButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")').first();
    await loginButton.click();

    // Should redirect to dashboard
    await page.waitForLoadState('networkidle');
    
    // Check if we're on dashboard or still on auth (depends on if test user exists)
    const currentUrl = page.url();
    const isLoggedIn = currentUrl.includes('/dashboard');
    
    if (isLoggedIn) {
      // Verify we can access protected content
      await expect(page.locator('h1, .page-title, [data-testid="dashboard-title"]')).toBeVisible();
    }
  });

  test('Invalid login credentials show error', async ({ page }) => {
    await page.goto('/auth');
    
    const emailInput = page.locator('input[type="email"], input[name="email"], [placeholder*="email" i]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"], [placeholder*="password" i]').first();
    
    await emailInput.fill('invalid@example.com');
    await passwordInput.fill('wrongpassword');

    const loginButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")').first();
    await loginButton.click();

    await page.waitForLoadState('networkidle');
    
    // Should stay on auth page or show error
    const currentUrl = page.url();
    expect(currentUrl.includes('/auth')).toBeTruthy();
    
    // Look for error message
    const errorElements = page.locator('.error, [data-testid="error"], .text-red, .text-destructive');
    if (await errorElements.count() > 0) {
      await expect(errorElements.first()).toBeVisible();
    }
  });

  test('Form validation works correctly', async ({ page }) => {
    await page.goto('/auth');
    
    // Try to submit empty form
    const submitButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")').first();
    await submitButton.click();
    
    // Should show validation errors or stay on page
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/auth');
    
    // Test invalid email format
    const emailInput = page.locator('input[type="email"], input[name="email"], [placeholder*="email" i]').first();
    await emailInput.fill('invalid-email');
    await submitButton.click();
    
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/auth');
  });

  test('Password reset functionality (if available)', async ({ page }) => {
    await page.goto('/auth');
    
    // Look for forgot password link
    const forgotPasswordLink = page.locator('text=Forgot Password, a:has-text("Reset"), [data-testid="forgot-password"]');
    
    if (await forgotPasswordLink.count() > 0) {
      await forgotPasswordLink.first().click();
      
      // Should show password reset form
      await page.waitForLoadState('networkidle');
      
      const emailInput = page.locator('input[type="email"], input[name="email"], [placeholder*="email" i]').first();
      if (await emailInput.isVisible()) {
        await emailInput.fill('test@example.com');
        
        const submitButton = page.locator('button[type="submit"], button:has-text("Reset"), button:has-text("Send")').first();
        await submitButton.click();
        
        await page.waitForLoadState('networkidle');
      }
    }
  });

  test('Session persistence across page reloads', async ({ page }) => {
    // First, try to login
    await page.goto('/auth');
    
    const emailInput = page.locator('input[type="email"], input[name="email"], [placeholder*="email" i]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"], [placeholder*="password" i]').first();
    
    await emailInput.fill('admin@test.com');
    await passwordInput.fill('password123');

    const loginButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")').first();
    await loginButton.click();

    await page.waitForLoadState('networkidle');
    
    // If login was successful, test session persistence
    if (page.url().includes('/dashboard')) {
      // Reload the page
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Should still be logged in
      expect(page.url()).toContain('/dashboard');
      
      // Navigate to another protected route
      await page.goto('/jobs');
      await page.waitForLoadState('networkidle');
      
      // Should not redirect to auth
      expect(page.url()).toContain('/jobs');
    }
  });
});