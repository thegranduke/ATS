import { Page, expect } from '@playwright/test';

export class TestHelpers {
  constructor(private page: Page) {}

  // Authentication helpers
  async login(email: string = 'admin@test.com', password: string = 'password123') {
    await this.page.goto('/auth');
    await this.page.fill('[data-testid="email-input"]', email);
    await this.page.fill('[data-testid="password-input"]', password);
    await this.page.click('[data-testid="login-button"]');
    await this.page.waitForURL('/dashboard');
  }

  async logout() {
    await this.page.click('[data-testid="user-avatar-menu"]');
    await this.page.click('[data-testid="logout-button"]');
    await this.page.waitForURL('/');
  }

  async register(email: string, password: string, companyName: string) {
    await this.page.goto('/auth');
    await this.page.click('[data-testid="register-tab"]');
    await this.page.fill('[data-testid="company-name-input"]', companyName);
    await this.page.fill('[data-testid="email-input"]', email);
    await this.page.fill('[data-testid="password-input"]', password);
    await this.page.click('[data-testid="register-button"]');
    await this.page.waitForURL('/dashboard');
  }

  // Navigation helpers
  async navigateToPage(path: string) {
    await this.page.goto(path);
    await this.page.waitForLoadState('networkidle');
  }

  async clickNavItem(navItem: string) {
    await this.page.click(`[data-testid="nav-${navItem}"]`);
    await this.page.waitForLoadState('networkidle');
  }

  // Wait helpers
  async waitForElementVisible(selector: string, timeout: number = 5000) {
    await this.page.waitForSelector(selector, { state: 'visible', timeout });
  }

  async waitForElementHidden(selector: string, timeout: number = 5000) {
    await this.page.waitForSelector(selector, { state: 'hidden', timeout });
  }

  // Form helpers
  async fillForm(formData: Record<string, string>) {
    for (const [field, value] of Object.entries(formData)) {
      await this.page.fill(`[data-testid="${field}-input"]`, value);
    }
  }

  async submitForm(submitButtonTestId: string = 'submit-button') {
    await this.page.click(`[data-testid="${submitButtonTestId}"]`);
  }

  // Validation helpers
  async expectPageTitle(title: string) {
    await expect(this.page).toHaveTitle(new RegExp(title, 'i'));
  }

  async expectElementVisible(selector: string) {
    await expect(this.page.locator(selector)).toBeVisible();
  }

  async expectElementHidden(selector: string) {
    await expect(this.page.locator(selector)).toBeHidden();
  }

  async expectTextContent(selector: string, text: string) {
    await expect(this.page.locator(selector)).toContainText(text);
  }

  async expectURL(url: string) {
    await expect(this.page).toHaveURL(new RegExp(url));
  }

  // Data setup helpers
  async createTestJob(jobData: any = {}) {
    const defaultJob = {
      title: 'Test Software Engineer',
      department: 'Engineering',
      description: 'Test job description',
      type: 'full-time',
      location: 'Remote',
      ...jobData
    };

    await this.navigateToPage('/jobs');
    await this.page.click('[data-testid="add-job-button"]');
    await this.fillForm(defaultJob);
    await this.submitForm('create-job-button');
    await this.page.waitForURL('/jobs');
    return defaultJob;
  }

  async createTestCandidate(candidateData: any = {}) {
    const defaultCandidate = {
      'full-name': 'John Doe',
      email: 'john.doe@example.com',
      phone: '+1-555-0123',
      ...candidateData
    };

    await this.navigateToPage('/candidates');
    await this.page.click('[data-testid="add-candidate-button"]');
    await this.fillForm(defaultCandidate);
    await this.submitForm('create-candidate-button');
    await this.page.waitForURL('/candidates');
    return defaultCandidate;
  }

  // Search and filter helpers
  async performSearch(searchTerm: string) {
    await this.page.fill('[data-testid="search-input"]', searchTerm);
    await this.page.press('[data-testid="search-input"]', 'Enter');
    await this.page.waitForLoadState('networkidle');
  }

  // Notification helpers
  async expectSuccessNotification(message?: string) {
    await this.expectElementVisible('[data-testid="success-notification"]');
    if (message) {
      await this.expectTextContent('[data-testid="success-notification"]', message);
    }
  }

  async expectErrorNotification(message?: string) {
    await this.expectElementVisible('[data-testid="error-notification"]');
    if (message) {
      await this.expectTextContent('[data-testid="error-notification"]', message);
    }
  }

  // Utility methods
  async takeScreenshot(name: string) {
    await this.page.screenshot({ path: `e2e/screenshots/${name}.png`, fullPage: true });
  }

  async getElementText(selector: string): Promise<string> {
    return await this.page.locator(selector).textContent() || '';
  }

  async isElementVisible(selector: string): Promise<boolean> {
    return await this.page.locator(selector).isVisible();
  }
}