#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_CONFIG = {
  headless: true,
  workers: 1,
  timeout: 30000,
  retries: 1
};

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logHeader(message) {
  log(`\n${colors.bold}${colors.blue}${'='.repeat(60)}${colors.reset}`);
  log(`${colors.bold}${colors.blue}${message}${colors.reset}`);
  log(`${colors.bold}${colors.blue}${'='.repeat(60)}${colors.reset}\n`);
}

function runCommand(command, description) {
  log(`Running: ${description}`, 'blue');
  try {
    const output = execSync(command, { 
      encoding: 'utf8', 
      stdio: 'pipe',
      cwd: process.cwd()
    });
    return { success: true, output };
  } catch (error) {
    return { 
      success: false, 
      error: error.message,
      output: error.stdout || error.stderr || ''
    };
  }
}

function generateTestReport(results) {
  const reportPath = path.join(__dirname, '..', 'test-results.json');
  
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      passed: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      successRate: `${Math.round((results.filter(r => r.success).length / results.length) * 100)}%`
    },
    results: results
  };
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log(`\nTest report generated: ${reportPath}`, 'blue');
  
  return report;
}

async function main() {
  logHeader('RecruitFlow E2E Test Suite Runner');
  
  log('Starting comprehensive E2E testing for all pages...', 'blue');
  
  // Test files to run
  const testFiles = [
    '01-public-pages.spec.ts',
    '02-authentication.spec.ts', 
    '03-dashboard.spec.ts',
    '04-job-management.spec.ts',
    '05-candidate-management.spec.ts',
    '06-settings-and-admin.spec.ts',
    '07-reporting-analytics.spec.ts',
    '08-billing-help.spec.ts',
    '09-cross-page-workflows.spec.ts'
  ];
  
  const results = [];
  let totalPassed = 0;
  let totalFailed = 0;
  
  log(`Running ${testFiles.length} test suites...\n`, 'yellow');
  
  for (const testFile of testFiles) {
    const testName = testFile.replace('.spec.ts', '');
    log(`\n${'─'.repeat(50)}`, 'blue');
    log(`Running: ${testName}`, 'bold');
    log(`${'─'.repeat(50)}`, 'blue');
    
    const command = `npx playwright test e2e/tests/${testFile} --headed=${!TEST_CONFIG.headless} --workers=${TEST_CONFIG.workers} --timeout=${TEST_CONFIG.timeout} --retries=${TEST_CONFIG.retries}`;
    
    const result = runCommand(command, `E2E tests for ${testName}`);
    
    if (result.success) {
      log(`✅ ${testName} - PASSED`, 'green');
      totalPassed++;
    } else {
      log(`❌ ${testName} - FAILED`, 'red');
      log(`Error: ${result.error}`, 'red');
      if (result.output) {
        log(`Output: ${result.output.slice(0, 500)}...`, 'yellow');
      }
      totalFailed++;
    }
    
    results.push({
      testFile,
      testName,
      success: result.success,
      error: result.error || null,
      output: result.output || null
    });
  }
  
  // Generate comprehensive report
  logHeader('Test Results Summary');
  
  const report = generateTestReport(results);
  
  log(`Total Test Suites: ${report.summary.total}`, 'blue');
  log(`Passed: ${report.summary.passed}`, 'green');
  log(`Failed: ${report.summary.failed}`, 'red');
  log(`Success Rate: ${report.summary.successRate}`, 'bold');
  
  if (report.summary.failed > 0) {
    log('\n❌ Failed Test Suites:', 'red');
    results.filter(r => !r.success).forEach(result => {
      log(`  - ${result.testName}`, 'red');
    });
  }
  
  // Run HTML report generation
  log('\nGenerating HTML test report...', 'blue');
  const htmlReportResult = runCommand('npx playwright show-report', 'HTML Report Generation');
  
  if (htmlReportResult.success) {
    log('✅ HTML report generated successfully', 'green');
    log('Run "npx playwright show-report" to view the detailed report', 'blue');
  }
  
  logHeader('E2E Test Suite Complete');
  
  if (totalFailed === 0) {
    log('🎉 All tests passed! Your RecruitFlow application is working correctly.', 'green');
    process.exit(0);
  } else {
    log(`⚠️  ${totalFailed} test suite(s) failed. Please review the results above.`, 'yellow');
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log(`
RecruitFlow E2E Test Runner

Usage: node e2e/run-tests.js [options]

Options:
  --help        Show this help message
  --headless    Run tests in headless mode (default: true)
  --headed      Run tests with browser UI visible
  --debug       Run with debugging enabled

Examples:
  node e2e/run-tests.js                    # Run all tests headless
  node e2e/run-tests.js --headed           # Run with browser visible
  npm run test:e2e                         # Use npm script
  
Test Coverage:
  ✓ Public pages (landing, auth, terms, privacy)
  ✓ Authentication flows (login, registration, validation)
  ✓ Dashboard functionality and navigation
  ✓ Job management (CRUD, search, filters, status)
  ✓ Candidate management (CRUD, pipeline, documents)
  ✓ Settings and admin (user mgmt, integrations, locations)
  ✓ Reporting and analytics (metrics, charts, exports)
  ✓ Billing and help center (subscriptions, support)
  ✓ Cross-page workflows and integration tests
`);
  process.exit(0);
}

if (args.includes('--headed')) {
  TEST_CONFIG.headless = false;
}

// Run the tests
main().catch(error => {
  log(`\nFatal error: ${error.message}`, 'red');
  process.exit(1);
});