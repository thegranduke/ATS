# Test info

- Name: Public Pages - Unauthenticated Access >> Page performance and loading
- Location: /home/runner/workspace/e2e/tests/01-public-pages.spec.ts:149:3

# Error details

```
Error: browserType.launch: Executable doesn't exist at /home/runner/workspace/.cache/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell
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
  112 |       '/billing',
  113 |       '/reporting',
  114 |       '/help'
  115 |     ];
  116 |
  117 |     for (const route of protectedRoutes) {
  118 |       await page.goto(route);
  119 |       
  120 |       // Should redirect to auth or landing page
  121 |       await page.waitForLoadState('networkidle');
  122 |       const currentUrl = page.url();
  123 |       
  124 |       expect(
  125 |         currentUrl.includes('/auth') || 
  126 |         currentUrl.includes('/') && !currentUrl.includes(route)
  127 |       ).toBeTruthy();
  128 |     }
  129 |   });
  130 |
  131 |   test('Navigation accessibility and responsiveness', async ({ page }) => {
  132 |     await page.goto('/');
  133 |     
  134 |     // Test mobile responsiveness
  135 |     await page.setViewportSize({ width: 375, height: 667 });
  136 |     await page.waitForLoadState('networkidle');
  137 |     
  138 |     // Check if mobile menu toggle is present
  139 |     const mobileMenu = page.locator('[data-testid="mobile-menu"], .mobile-menu, .hamburger-menu');
  140 |     if (await mobileMenu.isVisible()) {
  141 |       await mobileMenu.click();
  142 |       await expect(page.locator('.mobile-nav, [data-testid="mobile-nav"]')).toBeVisible();
  143 |     }
  144 |     
  145 |     // Reset to desktop view
  146 |     await page.setViewportSize({ width: 1280, height: 720 });
  147 |   });
  148 |
> 149 |   test('Page performance and loading', async ({ page }) => {
      |   ^ Error: browserType.launch: Executable doesn't exist at /home/runner/workspace/.cache/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell
  150 |     // Test page load performance
  151 |     const startTime = Date.now();
  152 |     await page.goto('/');
  153 |     await page.waitForLoadState('networkidle');
  154 |     const loadTime = Date.now() - startTime;
  155 |     
  156 |     // Page should load within reasonable time (10 seconds)
  157 |     expect(loadTime).toBeLessThan(10000);
  158 |     
  159 |     // Check for basic performance metrics
  160 |     const performanceMetrics = await page.evaluate(() => {
  161 |       const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  162 |       return {
  163 |         domContentLoaded: navigation.domContentLoadedEventEnd - navigation.navigationStart,
  164 |         loadComplete: navigation.loadEventEnd - navigation.navigationStart
  165 |       };
  166 |     });
  167 |     
  168 |     expect(performanceMetrics.domContentLoaded).toBeGreaterThan(0);
  169 |   });
  170 | });
```