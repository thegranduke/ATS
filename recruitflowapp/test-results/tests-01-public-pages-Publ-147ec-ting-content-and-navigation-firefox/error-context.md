# Test info

- Name: Public Pages - Unauthenticated Access >> Landing Page - Should display marketing content and navigation
- Location: /home/runner/workspace/e2e/tests/01-public-pages.spec.ts:11:3

# Error details

```
Error: browserType.launch: Executable doesn't exist at /home/runner/workspace/.cache/ms-playwright/firefox-1482/firefox/firefox
╔═════════════════════════════════════════════════════════════════════════╗
║ Looks like Playwright Test or Playwright was just installed or updated. ║
║ Please run the following command to download new browsers:              ║
║                                                                         ║
║     npx playwright install                                              ║
║                                                                         ║
║ <3 Playwright Team                                                      ║
╚═════════════════════════════════════════════════════════════════════════╝
```

# Test source

```ts
   1 | import { test, expect } from '@playwright/test';
   2 | import { TestHelpers } from '../utils/test-helpers';
   3 |
   4 | test.describe('Public Pages - Unauthenticated Access', () => {
   5 |   let helpers: TestHelpers;
   6 |
   7 |   test.beforeEach(async ({ page }) => {
   8 |     helpers = new TestHelpers(page);
   9 |   });
   10 |
>  11 |   test('Landing Page - Should display marketing content and navigation', async ({ page }) => {
      |   ^ Error: browserType.launch: Executable doesn't exist at /home/runner/workspace/.cache/ms-playwright/firefox-1482/firefox/firefox
   12 |     await page.goto('/');
   13 |     
   14 |     // Check page loads correctly
   15 |     await expect(page).toHaveTitle(/RecruitFlow|HireTrack/);
   16 |     
   17 |     // Verify key elements are visible
   18 |     await expect(page.locator('h1')).toBeVisible();
   19 |     await expect(page.locator('[data-testid="cta-button"], .cta-button, [href="/auth"]')).toBeVisible();
   20 |     
   21 |     // Test navigation to auth page
   22 |     const authLink = page.locator('[href="/auth"], [data-testid="get-started"], .auth-link').first();
   23 |     if (await authLink.isVisible()) {
   24 |       await authLink.click();
   25 |       await expect(page).toHaveURL(/.*\/auth/);
   26 |     }
   27 |   });
   28 |
   29 |   test('Auth Page - Login functionality', async ({ page }) => {
   30 |     await page.goto('/auth');
   31 |     
   32 |     // Verify auth form is present
   33 |     await expect(page.locator('input[type="email"], [placeholder*="email" i]')).toBeVisible();
   34 |     await expect(page.locator('input[type="password"], [placeholder*="password" i]')).toBeVisible();
   35 |     
   36 |     // Test form validation - empty fields
   37 |     const submitButton = page.locator('button[type="submit"], [data-testid="login-button"], button:has-text("Sign In")').first();
   38 |     await submitButton.click();
   39 |     
   40 |     // Should show validation messages or stay on page
   41 |     await expect(page).toHaveURL(/.*\/auth/);
   42 |   });
   43 |
   44 |   test('Auth Page - Registration functionality', async ({ page }) => {
   45 |     await page.goto('/auth');
   46 |     
   47 |     // Look for registration tab or form
   48 |     const registerTab = page.locator('[data-testid="register-tab"], button:has-text("Register"), a:has-text("Sign Up")');
   49 |     if (await registerTab.isVisible()) {
   50 |       await registerTab.click();
   51 |       
   52 |       // Verify registration fields
   53 |       await expect(page.locator('input[type="email"], [placeholder*="email" i]')).toBeVisible();
   54 |       await expect(page.locator('input[type="password"], [placeholder*="password" i]')).toBeVisible();
   55 |     }
   56 |   });
   57 |
   58 |   test('Application Form - Public job application', async ({ page }) => {
   59 |     // Test both URL patterns for application forms
   60 |     const testUrls = ['/apply/test-link', '/j/1/abc123'];
   61 |     
   62 |     for (const url of testUrls) {
   63 |       await page.goto(url);
   64 |       
   65 |       // Should show application form or redirect appropriately
   66 |       // Don't expect specific behavior since jobs may not exist in test environment
   67 |       await page.waitForLoadState('networkidle');
   68 |       
   69 |       // Check if form elements are present (if job exists)
   70 |       const hasForm = await page.locator('form, input[type="email"]').count() > 0;
   71 |       if (hasForm) {
   72 |         await expect(page.locator('input[type="email"], [placeholder*="email" i]')).toBeVisible();
   73 |       }
   74 |     }
   75 |   });
   76 |
   77 |   test('Terms of Service page', async ({ page }) => {
   78 |     await page.goto('/terms');
   79 |     
   80 |     // Verify page loads and contains legal content
   81 |     await expect(page.locator('h1, .page-title')).toBeVisible();
   82 |     
   83 |     // Should contain typical terms content
   84 |     const pageContent = await page.textContent('body');
   85 |     const hasLegalContent = pageContent?.toLowerCase().includes('terms') || 
   86 |                            pageContent?.toLowerCase().includes('service') ||
   87 |                            pageContent?.toLowerCase().includes('agreement');
   88 |     expect(hasLegalContent).toBeTruthy();
   89 |   });
   90 |
   91 |   test('Privacy Policy page', async ({ page }) => {
   92 |     await page.goto('/privacy');
   93 |     
   94 |     // Verify page loads and contains privacy content
   95 |     await expect(page.locator('h1, .page-title')).toBeVisible();
   96 |     
   97 |     // Should contain typical privacy content
   98 |     const pageContent = await page.textContent('body');
   99 |     const hasPrivacyContent = pageContent?.toLowerCase().includes('privacy') || 
  100 |                              pageContent?.toLowerCase().includes('data') ||
  101 |                              pageContent?.toLowerCase().includes('information');
  102 |     expect(hasPrivacyContent).toBeTruthy();
  103 |   });
  104 |
  105 |   test('Protected routes redirect to auth when not logged in', async ({ page }) => {
  106 |     const protectedRoutes = [
  107 |       '/dashboard',
  108 |       '/jobs',
  109 |       '/candidates',
  110 |       '/settings',
  111 |       '/user-settings',
```