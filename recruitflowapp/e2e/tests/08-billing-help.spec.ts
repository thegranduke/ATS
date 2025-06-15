import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';

test.describe('Billing and Help Center Pages', () => {
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

  test('Billing page displays subscription information', async ({ page }) => {
    await page.goto('/billing');
    await page.waitForLoadState('networkidle');
    
    // Verify billing page loads
    await expect(page.locator('h1, .page-title, [data-testid*="title"]')).toBeVisible();
    
    // Look for subscription information
    const subscriptionInfo = page.locator('.subscription, .plan, [data-testid*="subscription"]');
    const currentPlan = page.locator('.current-plan, [data-testid*="current-plan"]');
    
    if (await subscriptionInfo.isVisible()) {
      await expect(subscriptionInfo).toBeVisible();
    }
    
    if (await currentPlan.isVisible()) {
      await expect(currentPlan).toBeVisible();
    }
    
    // Should show lite plan or free tier during beta
    const pageContent = await page.textContent('body');
    const hasLitePlan = pageContent?.toLowerCase().includes('lite') || 
                       pageContent?.toLowerCase().includes('free') ||
                       pageContent?.toLowerCase().includes('beta');
    expect(hasLitePlan).toBeTruthy();
  });

  test('Billing history and invoices', async ({ page }) => {
    await page.goto('/billing');
    await page.waitForLoadState('networkidle');
    
    // Look for billing history section
    const billingHistory = page.locator('.billing-history, .invoices, [data-testid*="history"]');
    const historyTab = page.locator('text=History, text=Invoices, [data-testid*="history"]');
    
    if (await historyTab.isVisible()) {
      await historyTab.click();
      await page.waitForLoadState('networkidle');
    }
    
    if (await billingHistory.isVisible()) {
      await expect(billingHistory).toBeVisible();
    }
    
    // Look for download invoice buttons
    const downloadButtons = page.locator('button:has-text("Download"), [data-testid*="download"]');
    if (await downloadButtons.count() > 0) {
      await expect(downloadButtons.first()).toBeVisible();
    }
  });

  test('Usage metrics and limits', async ({ page }) => {
    await page.goto('/billing');
    await page.waitForLoadState('networkidle');
    
    // Look for usage information
    const usageSection = page.locator('.usage, .limits, [data-testid*="usage"]');
    const usageTab = page.locator('text=Usage, [data-testid*="usage"]');
    
    if (await usageTab.isVisible()) {
      await usageTab.click();
      await page.waitForLoadState('networkidle');
    }
    
    if (await usageSection.isVisible()) {
      await expect(usageSection).toBeVisible();
    }
    
    // Look for progress bars or usage indicators
    const progressBars = page.locator('.progress, .usage-bar, [role="progressbar"]');
    if (await progressBars.count() > 0) {
      await expect(progressBars.first()).toBeVisible();
    }
  });

  test('Help Center page functionality', async ({ page }) => {
    await page.goto('/help');
    await page.waitForLoadState('networkidle');
    
    // Verify help center loads
    await expect(page.locator('h1, .page-title, [data-testid*="title"]')).toBeVisible();
    
    // Look for help articles or FAQ sections
    const helpArticles = page.locator('.help-article, .faq-item, [data-testid*="article"]');
    const searchBox = page.locator('input[type="search"], [placeholder*="search" i], [data-testid*="search"]');
    
    if (await helpArticles.count() > 0) {
      await expect(helpArticles.first()).toBeVisible();
    }
    
    if (await searchBox.isVisible()) {
      await searchBox.fill('how to add job');
      await searchBox.press('Enter');
      await page.waitForLoadState('networkidle');
    }
  });

  test('Contact support functionality', async ({ page }) => {
    await page.goto('/help');
    await page.waitForLoadState('networkidle');
    
    // Look for contact support button
    const contactButton = page.locator('button:has-text("Contact"), button:has-text("Support"), [data-testid*="contact"]');
    
    if (await contactButton.isVisible()) {
      await contactButton.click();
      await page.waitForLoadState('networkidle');
      
      // Should show contact form
      const contactForm = page.locator('form, .contact-form, [data-testid*="contact-form"]');
      if (await contactForm.isVisible()) {
        // Fill contact form
        const subjectInput = page.locator('input[name="subject"], [data-testid*="subject"]');
        const messageInput = page.locator('textarea[name="message"], [data-testid*="message"]');
        
        if (await subjectInput.isVisible()) {
          await subjectInput.fill('Test support request');
        }
        
        if (await messageInput.isVisible()) {
          await messageInput.fill('This is a test message for the support system.');
        }
        
        const submitButton = page.locator('button[type="submit"], button:has-text("Send"), [data-testid*="submit"]');
        if (await submitButton.isVisible()) {
          await submitButton.click();
          await page.waitForLoadState('networkidle');
        }
      }
    }
  });

  test('Documentation and guides access', async ({ page }) => {
    await page.goto('/help');
    await page.waitForLoadState('networkidle');
    
    // Look for documentation sections
    const docSections = page.locator('.documentation, .guides, [data-testid*="docs"]');
    const getStartedGuide = page.locator('text=Getting Started, text=Quick Start, [data-testid*="getting-started"]');
    
    if (await getStartedGuide.isVisible()) {
      await getStartedGuide.click();
      await page.waitForLoadState('networkidle');
      
      // Should show guide content
      const guideContent = page.locator('.guide-content, .doc-content, [data-testid*="content"]');
      if (await guideContent.isVisible()) {
        await expect(guideContent).toBeVisible();
      }
    }
    
    if (await docSections.count() > 0) {
      await expect(docSections.first()).toBeVisible();
    }
  });

  test('Feature request and feedback', async ({ page }) => {
    await page.goto('/help');
    await page.waitForLoadState('networkidle');
    
    // Look for feedback or feature request options
    const feedbackButton = page.locator('button:has-text("Feedback"), button:has-text("Feature"), [data-testid*="feedback"]');
    
    if (await feedbackButton.isVisible()) {
      await feedbackButton.click();
      await page.waitForLoadState('networkidle');
      
      // Should show feedback form
      const feedbackForm = page.locator('form, .feedback-form, [data-testid*="feedback-form"]');
      if (await feedbackForm.isVisible()) {
        const titleInput = page.locator('input[name="title"], [data-testid*="title"]');
        const descriptionInput = page.locator('textarea[name="description"], [data-testid*="description"]');
        
        if (await titleInput.isVisible()) {
          await titleInput.fill('Test Feature Request');
        }
        
        if (await descriptionInput.isVisible()) {
          await descriptionInput.fill('This is a test feature request.');
        }
        
        const submitButton = page.locator('button[type="submit"], button:has-text("Submit"), [data-testid*="submit"]');
        if (await submitButton.isVisible()) {
          await submitButton.click();
          await page.waitForLoadState('networkidle');
        }
      }
    }
  });

  test('Help search functionality', async ({ page }) => {
    await page.goto('/help');
    await page.waitForLoadState('networkidle');
    
    // Test help search
    const searchInput = page.locator('input[type="search"], [placeholder*="search" i], [data-testid*="search"]');
    
    if (await searchInput.isVisible()) {
      await searchInput.fill('candidate management');
      await searchInput.press('Enter');
      await page.waitForLoadState('networkidle');
      
      // Should show search results
      const searchResults = page.locator('.search-results, .help-results, [data-testid*="results"]');
      if (await searchResults.isVisible()) {
        await expect(searchResults).toBeVisible();
      }
    }
  });

  test('Video tutorials and resources', async ({ page }) => {
    await page.goto('/help');
    await page.waitForLoadState('networkidle');
    
    // Look for video tutorials section
    const videoSection = page.locator('.videos, .tutorials, [data-testid*="videos"]');
    const videoLinks = page.locator('a[href*="youtube"], a[href*="video"], [data-testid*="video"]');
    
    if (await videoSection.isVisible()) {
      await expect(videoSection).toBeVisible();
    }
    
    if (await videoLinks.count() > 0) {
      await expect(videoLinks.first()).toBeVisible();
    }
  });

  test('Keyboard shortcuts help', async ({ page }) => {
    await page.goto('/help');
    await page.waitForLoadState('networkidle');
    
    // Look for keyboard shortcuts section
    const shortcutsSection = page.locator('.shortcuts, .hotkeys, [data-testid*="shortcuts"]');
    const shortcutsButton = page.locator('button:has-text("Shortcuts"), button:has-text("Hotkeys"), [data-testid*="shortcuts"]');
    
    if (await shortcutsButton.isVisible()) {
      await shortcutsButton.click();
      await page.waitForLoadState('networkidle');
    }
    
    if (await shortcutsSection.isVisible()) {
      await expect(shortcutsSection).toBeVisible();
    }
  });
});