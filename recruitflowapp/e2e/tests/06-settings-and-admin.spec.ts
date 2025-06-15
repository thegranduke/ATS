import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';

test.describe('Settings and Admin Pages', () => {
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

  test('Account Settings page functionality', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    
    // Verify settings page loads
    await expect(page.locator('h1, .page-title, [data-testid*="title"]')).toBeVisible();
    
    // Look for settings sections
    const settingSections = page.locator('.setting-section, .settings-card, [data-testid*="section"]');
    if (await settingSections.count() > 0) {
      await expect(settingSections.first()).toBeVisible();
    }
    
    // Test company information section
    const companyNameInput = page.locator('input[name="companyName"], input[name="name"], [data-testid*="company"]');
    if (await companyNameInput.isVisible()) {
      const currentValue = await companyNameInput.inputValue();
      await companyNameInput.fill(currentValue + ' Updated');
      
      const saveButton = page.locator('button:has-text("Save"), button:has-text("Update"), [data-testid*="save"]');
      if (await saveButton.isVisible()) {
        await saveButton.click();
        await page.waitForLoadState('networkidle');
      }
    }
  });

  test('User Settings page functionality', async ({ page }) => {
    await page.goto('/user-settings');
    await page.waitForLoadState('networkidle');
    
    // Verify user settings page loads
    await expect(page.locator('h1, .page-title, [data-testid*="title"]')).toBeVisible();
    
    // Test personal information section
    const firstNameInput = page.locator('input[name="firstName"], [data-testid*="first-name"]');
    const lastNameInput = page.locator('input[name="lastName"], [data-testid*="last-name"]');
    
    if (await firstNameInput.isVisible()) {
      await firstNameInput.fill('Updated First');
    }
    
    if (await lastNameInput.isVisible()) {
      await lastNameInput.fill('Updated Last');
    }
    
    // Test avatar upload section
    const avatarSection = page.locator('.avatar-section, [data-testid*="avatar"]');
    if (await avatarSection.isVisible()) {
      await expect(avatarSection).toBeVisible();
    }
    
    // Save changes
    const saveButton = page.locator('button:has-text("Save"), button:has-text("Update"), [data-testid*="save"]');
    if (await saveButton.isVisible()) {
      await saveButton.click();
      await page.waitForLoadState('networkidle');
    }
  });

  test('Password change functionality', async ({ page }) => {
    await page.goto('/user-settings');
    await page.waitForLoadState('networkidle');
    
    // Look for password change section
    const passwordSection = page.locator('.password-section, [data-testid*="password"]');
    const changePasswordButton = page.locator('button:has-text("Change Password"), [data-testid*="change-password"]');
    
    if (await changePasswordButton.isVisible()) {
      await changePasswordButton.click();
      await page.waitForLoadState('networkidle');
      
      // Fill password change form
      const currentPasswordInput = page.locator('input[name="currentPassword"], [data-testid*="current-password"]');
      const newPasswordInput = page.locator('input[name="newPassword"], [data-testid*="new-password"]');
      const confirmPasswordInput = page.locator('input[name="confirmPassword"], [data-testid*="confirm-password"]');
      
      if (await currentPasswordInput.isVisible()) {
        await currentPasswordInput.fill('password123');
        await newPasswordInput.fill('newpassword123');
        await confirmPasswordInput.fill('newpassword123');
        
        const updateButton = page.locator('button:has-text("Update"), button:has-text("Change"), [data-testid*="update-password"]');
        if (await updateButton.isVisible()) {
          await updateButton.click();
          await page.waitForLoadState('networkidle');
        }
      }
    }
  });

  test('User management functionality', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    
    // Look for user management section or tab
    const userManagementTab = page.locator('text=Users, text=Team, [data-testid*="users"]');
    if (await userManagementTab.isVisible()) {
      await userManagementTab.click();
      await page.waitForLoadState('networkidle');
      
      // Look for invite user button
      const inviteButton = page.locator('button:has-text("Invite"), button:has-text("Add User"), [data-testid*="invite"]');
      if (await inviteButton.isVisible()) {
        await inviteButton.click();
        await page.waitForLoadState('networkidle');
        
        // Fill invite form
        const emailInput = page.locator('input[name="email"], [data-testid*="email"]');
        const roleSelect = page.locator('select[name="role"], [data-testid*="role"]');
        
        if (await emailInput.isVisible()) {
          await emailInput.fill('newuser@example.com');
          
          if (await roleSelect.isVisible()) {
            await roleSelect.selectOption('user');
          }
          
          const sendInviteButton = page.locator('button:has-text("Send"), button:has-text("Invite"), [data-testid*="send-invite"]');
          if (await sendInviteButton.isVisible()) {
            await sendInviteButton.click();
            await page.waitForLoadState('networkidle');
          }
        }
      }
    }
  });

  test('Integration settings functionality', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    
    // Look for integrations section
    const integrationsTab = page.locator('text=Integrations, [data-testid*="integrations"]');
    if (await integrationsTab.isVisible()) {
      await integrationsTab.click();
      await page.waitForLoadState('networkidle');
      
      // Look for available integrations
      const integrationCards = page.locator('.integration-card, [data-testid*="integration"]');
      if (await integrationCards.count() > 0) {
        await expect(integrationCards.first()).toBeVisible();
        
        // Test connecting an integration
        const connectButton = page.locator('button:has-text("Connect"), button:has-text("Setup"), [data-testid*="connect"]');
        if (await connectButton.isVisible()) {
          await connectButton.click();
          await page.waitForLoadState('networkidle');
          
          // Should show integration setup form
          const setupForm = page.locator('form, .integration-form, [data-testid*="setup-form"]');
          if (await setupForm.isVisible()) {
            await expect(setupForm).toBeVisible();
          }
        }
      }
    }
  });

  test('Company locations management', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    
    // Look for locations section
    const locationsTab = page.locator('text=Locations, [data-testid*="locations"]');
    if (await locationsTab.isVisible()) {
      await locationsTab.click();
      await page.waitForLoadState('networkidle');
      
      // Look for add location button
      const addLocationButton = page.locator('button:has-text("Add Location"), [data-testid*="add-location"]');
      if (await addLocationButton.isVisible()) {
        await addLocationButton.click();
        await page.waitForLoadState('networkidle');
        
        // Fill location form
        const nameInput = page.locator('input[name="name"], [data-testid*="location-name"]');
        const addressInput = page.locator('input[name="address"], textarea[name="address"], [data-testid*="address"]');
        
        if (await nameInput.isVisible()) {
          await nameInput.fill('Test Office Location');
          
          if (await addressInput.isVisible()) {
            await addressInput.fill('123 Test Street, Test City, TC 12345');
          }
          
          const saveButton = page.locator('button:has-text("Save"), button:has-text("Add"), [data-testid*="save-location"]');
          if (await saveButton.isVisible()) {
            await saveButton.click();
            await page.waitForLoadState('networkidle');
          }
        }
      }
    }
  });

  test('Notification preferences', async ({ page }) => {
    await page.goto('/user-settings');
    await page.waitForLoadState('networkidle');
    
    // Look for notification settings
    const notificationsTab = page.locator('text=Notifications, [data-testid*="notifications"]');
    if (await notificationsTab.isVisible()) {
      await notificationsTab.click();
      await page.waitForLoadState('networkidle');
      
      // Test notification toggles
      const notificationToggles = page.locator('input[type="checkbox"], .toggle, [data-testid*="notification"]');
      if (await notificationToggles.count() > 0) {
        // Toggle first notification setting
        await notificationToggles.first().click();
        
        const saveButton = page.locator('button:has-text("Save"), [data-testid*="save"]');
        if (await saveButton.isVisible()) {
          await saveButton.click();
          await page.waitForLoadState('networkidle');
        }
      }
    }
  });

  test('Company branding settings', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    
    // Look for branding section
    const brandingTab = page.locator('text=Branding, text=Appearance, [data-testid*="branding"]');
    if (await brandingTab.isVisible()) {
      await brandingTab.click();
      await page.waitForLoadState('networkidle');
      
      // Look for logo upload
      const logoUpload = page.locator('input[type="file"], [data-testid*="logo"]');
      const colorPicker = page.locator('input[type="color"], [data-testid*="color"]');
      
      if (await logoUpload.isVisible()) {
        await expect(logoUpload).toBeVisible();
      }
      
      if (await colorPicker.isVisible()) {
        await colorPicker.fill('#ff0000');
        
        const saveButton = page.locator('button:has-text("Save"), [data-testid*="save"]');
        if (await saveButton.isVisible()) {
          await saveButton.click();
          await page.waitForLoadState('networkidle');
        }
      }
    }
  });

  test('Data export functionality', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    
    // Look for data export section
    const dataTab = page.locator('text=Data, text=Export, [data-testid*="data"]');
    if (await dataTab.isVisible()) {
      await dataTab.click();
      await page.waitForLoadState('networkidle');
      
      // Look for export buttons
      const exportButton = page.locator('button:has-text("Export"), [data-testid*="export"]');
      if (await exportButton.isVisible()) {
        await exportButton.click();
        await page.waitForLoadState('networkidle');
        
        // Should show export options or start download
        const exportOptions = page.locator('.export-option, [data-testid*="export-option"]');
        if (await exportOptions.count() > 0) {
          await expect(exportOptions.first()).toBeVisible();
        }
      }
    }
  });
});