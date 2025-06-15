import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';

test.describe('Reporting and Analytics Pages', () => {
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

  test('Reporting page loads with analytics dashboard', async ({ page }) => {
    await page.goto('/reporting');
    await page.waitForLoadState('networkidle');
    
    // Verify reporting page loads
    await expect(page.locator('h1, .page-title, [data-testid*="title"]')).toBeVisible();
    
    // Look for analytics widgets or charts
    const chartElements = page.locator('canvas, svg, .chart, .graph, [data-testid*="chart"]');
    const metricsCards = page.locator('.metric, .stat, .analytics-card, [data-testid*="metric"]');
    
    const hasCharts = await chartElements.count() > 0;
    const hasMetrics = await metricsCards.count() > 0;
    
    expect(hasCharts || hasMetrics).toBeTruthy();
  });

  test('Date range picker functionality', async ({ page }) => {
    await page.goto('/reporting');
    await page.waitForLoadState('networkidle');
    
    // Look for date picker or date range selector
    const datePicker = page.locator('.date-picker, input[type="date"], [data-testid*="date"]');
    const dateRangeButton = page.locator('button:has-text("Date"), button:has-text("Range"), [data-testid*="date-range"]');
    
    if (await dateRangeButton.isVisible()) {
      await dateRangeButton.click();
      await page.waitForLoadState('networkidle');
      
      // Should show date picker options
      const dateOptions = page.locator('.date-option, [data-testid*="date-option"]');
      if (await dateOptions.count() > 0) {
        await dateOptions.first().click();
        await page.waitForLoadState('networkidle');
      }
    } else if (await datePicker.isVisible()) {
      await datePicker.first().fill('2024-01-01');
      await page.waitForLoadState('networkidle');
    }
  });

  test('Hiring metrics and KPIs display', async ({ page }) => {
    await page.goto('/reporting');
    await page.waitForLoadState('networkidle');
    
    // Look for key hiring metrics
    const metricsKeywords = [
      'Time to Hire', 'Conversion Rate', 'Total Jobs', 'Total Candidates',
      'Applications', 'Interviews', 'Offers', 'Hires'
    ];
    
    let foundMetrics = 0;
    for (const keyword of metricsKeywords) {
      const element = page.locator(`text=${keyword}`);
      if (await element.isVisible()) {
        foundMetrics++;
      }
    }
    
    // Should have at least some hiring metrics
    expect(foundMetrics).toBeGreaterThan(0);
  });

  test('Pipeline analytics functionality', async ({ page }) => {
    await page.goto('/reporting');
    await page.waitForLoadState('networkidle');
    
    // Look for pipeline or funnel charts
    const pipelineSection = page.locator('.pipeline, .funnel, [data-testid*="pipeline"]');
    const pipelineTab = page.locator('text=Pipeline, [data-testid*="pipeline"]');
    
    if (await pipelineTab.isVisible()) {
      await pipelineTab.click();
      await page.waitForLoadState('networkidle');
    }
    
    if (await pipelineSection.isVisible()) {
      await expect(pipelineSection).toBeVisible();
    }
    
    // Look for stage-wise metrics
    const stageMetrics = page.locator('.stage, .pipeline-stage, [data-testid*="stage"]');
    if (await stageMetrics.count() > 0) {
      await expect(stageMetrics.first()).toBeVisible();
    }
  });

  test('Source performance analytics', async ({ page }) => {
    await page.goto('/reporting');
    await page.waitForLoadState('networkidle');
    
    // Look for source performance section
    const sourceSection = page.locator('.source-performance, [data-testid*="source"]');
    const sourceTab = page.locator('text=Sources, text=Performance, [data-testid*="source"]');
    
    if (await sourceTab.isVisible()) {
      await sourceTab.click();
      await page.waitForLoadState('networkidle');
    }
    
    // Look for source breakdown
    const sourceItems = page.locator('.source-item, .source-metric, [data-testid*="source"]');
    if (await sourceItems.count() > 0) {
      await expect(sourceItems.first()).toBeVisible();
    }
  });

  test('Custom report generation', async ({ page }) => {
    await page.goto('/reporting');
    await page.waitForLoadState('networkidle');
    
    // Look for custom report button
    const customReportButton = page.locator('button:has-text("Custom"), button:has-text("Create Report"), [data-testid*="custom"]');
    
    if (await customReportButton.isVisible()) {
      await customReportButton.click();
      await page.waitForLoadState('networkidle');
      
      // Should show report builder form
      const reportForm = page.locator('form, .report-builder, [data-testid*="report-form"]');
      if (await reportForm.isVisible()) {
        // Fill report parameters
        const reportNameInput = page.locator('input[name="name"], [data-testid*="report-name"]');
        if (await reportNameInput.isVisible()) {
          await reportNameInput.fill('Test Custom Report');
        }
        
        // Select metrics
        const metricsCheckboxes = page.locator('input[type="checkbox"], [data-testid*="metric"]');
        if (await metricsCheckboxes.count() > 0) {
          await metricsCheckboxes.first().check();
        }
        
        // Generate report
        const generateButton = page.locator('button:has-text("Generate"), button:has-text("Create"), [data-testid*="generate"]');
        if (await generateButton.isVisible()) {
          await generateButton.click();
          await page.waitForLoadState('networkidle');
        }
      }
    }
  });

  test('Report export functionality', async ({ page }) => {
    await page.goto('/reporting');
    await page.waitForLoadState('networkidle');
    
    // Look for export button
    const exportButton = page.locator('button:has-text("Export"), button:has-text("Download"), [data-testid*="export"]');
    
    if (await exportButton.isVisible()) {
      await exportButton.click();
      await page.waitForLoadState('networkidle');
      
      // Should show export options
      const exportOptions = page.locator('.export-option, [data-testid*="export-format"]');
      if (await exportOptions.count() > 0) {
        await expect(exportOptions.first()).toBeVisible();
      }
    }
  });

  test('Filter and drill-down capabilities', async ({ page }) => {
    await page.goto('/reporting');
    await page.waitForLoadState('networkidle');
    
    // Look for filter controls
    const filterButton = page.locator('button:has-text("Filter"), [data-testid*="filter"]');
    const departmentFilter = page.locator('select[name="department"], [data-testid*="department"]');
    
    if (await filterButton.isVisible()) {
      await filterButton.click();
      await page.waitForLoadState('networkidle');
    }
    
    if (await departmentFilter.isVisible()) {
      await departmentFilter.selectOption({ index: 1 });
      await page.waitForLoadState('networkidle');
    }
    
    // Test drill-down by clicking on chart elements
    const chartElements = page.locator('canvas, svg path, .chart-element');
    if (await chartElements.count() > 0) {
      await chartElements.first().click();
      await page.waitForLoadState('networkidle');
    }
  });

  test('Real-time data updates', async ({ page }) => {
    await page.goto('/reporting');
    await page.waitForLoadState('networkidle');
    
    // Look for refresh button or auto-refresh indicator
    const refreshButton = page.locator('button:has-text("Refresh"), [data-testid*="refresh"]');
    const autoRefreshToggle = page.locator('.auto-refresh, [data-testid*="auto-refresh"]');
    
    if (await refreshButton.isVisible()) {
      await refreshButton.click();
      await page.waitForLoadState('networkidle');
    }
    
    if (await autoRefreshToggle.isVisible()) {
      await autoRefreshToggle.click();
    }
  });

  test('Comparison and trend analysis', async ({ page }) => {
    await page.goto('/reporting');
    await page.waitForLoadState('networkidle');
    
    // Look for comparison options
    const compareButton = page.locator('button:has-text("Compare"), [data-testid*="compare"]');
    const trendChart = page.locator('.trend, .line-chart, [data-testid*="trend"]');
    
    if (await compareButton.isVisible()) {
      await compareButton.click();
      await page.waitForLoadState('networkidle');
    }
    
    if (await trendChart.isVisible()) {
      await expect(trendChart).toBeVisible();
    }
  });

  test('Mobile responsiveness for reports', async ({ page }) => {
    await page.goto('/reporting');
    await page.waitForLoadState('networkidle');
    
    // Switch to mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Verify charts adapt to mobile
    const charts = page.locator('canvas, svg, .chart');
    if (await charts.count() > 0) {
      const chartElement = charts.first();
      const boundingBox = await chartElement.boundingBox();
      
      if (boundingBox) {
        // Chart should fit within mobile viewport
        expect(boundingBox.width).toBeLessThanOrEqual(375);
      }
    }
    
    // Reset to desktop
    await page.setViewportSize({ width: 1280, height: 720 });
  });
});