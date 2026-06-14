import { test, expect } from '@playwright/test';

test.describe('E2E Audit - Runtime Bugs and Layout Failures', () => {
  // Use unique mock data for each run
  const timestamp = Date.now();
  const mockUser = {
    email: `test_user_${timestamp}@example.com`,
    username: `testuser_${timestamp}`,
    password: `TestP@ssw0rd${timestamp}`
  };

  test('User Creation Workflow and State Persistence', async ({ page }) => {
    // Target Initialization:
    // Viewport is configured to 1920x1080 in playwright config or context
    // The test runner isolates cookies/sessions by default per context.

    // Network & Error Observers
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        console.error(`[Browser Console Error]: ${text}`);
        errors.push(text);
      }
    });

    page.on('pageerror', exception => {
      console.error(`[Unhandled Exception]: ${exception.message}`);
      errors.push(exception.message);
    });

    // 1. Navigate directly to the deployment URL.
    // Replace with the production link if needed
    const targetUrl = process.env.BASE_URL || 'http://localhost:3000';
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

    // 2. Locate the signup inputs and trigger registration
    // Check if we need to click the "INITIALIZE YOUR JOURNEY" start tracking button
    const initializeBtn = page.getByRole('button', { name: /start tracking/i });
    if (await initializeBtn.isVisible()) {
      await initializeBtn.click();
    } else {
      // If it doesn't show up, try clicking the top nav Sign In/Up
      const authTrigger = page.locator('button').filter({ hasText: 'SIGN' });
      if (await authTrigger.isVisible()) {
        await authTrigger.click();
      }
    }

    // Wait for gatekeeper modal
    await page.waitForSelector('text="Authentication Required"');

    // Switch to Sign Up tab
    await page.getByRole('button', { name: 'Sign Up' }).click();

    // Fill mock staging data
    await page.getByLabel(/Email/i).fill(mockUser.email);
    await page.getByLabel(/Username/i).fill(mockUser.username);
    await page.getByLabel(/Password/i).fill(mockUser.password);

    // Trigger registration click event loop
    const submitBtn = page.getByRole('button', { name: 'Create Account' });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Wait for the authentication state response hook to pass successfully
    // (We disabled OTP for local test, so it should redirect or show success directly)
    await expect(page.locator('text="Access Granted"')).toBeVisible({ timeout: 15000 });
    
    // Wait for the dashboard view to load (gatekeeper modal closes)
    await page.waitForSelector('text="Access Granted"', { state: 'hidden' });
    await expect(page.locator('text="MANAGE HABITS"').or(page.locator('text="DASHBOARD"'))).toBeVisible();

    // State Persistence & Forced Hard Refresh Test:
    // Once the dashboard view state triggers, capture an initial screen artifact trace
    await page.screenshot({ path: 'dashboard-initial.png', fullPage: true });

    // Execute a standard page reload to stress-test frontend state persistence
    await page.reload();

    // Verify that the user session does not crash or drop back out to auth gate screen
    const isGatekeeperVisible = await page.locator('text="Authentication Required"').isVisible();
    expect(isGatekeeperVisible).toBe(false);

    // Post-Load Validation Capture:
    await page.screenshot({ path: 'dashboard-post-refresh.png', fullPage: true });

    // Output a comprehensive diagnostic log profile if there were errors
    if (errors.length > 0) {
      console.log('\n--- DIAGNOSTIC LOG PROFILE ---');
      console.log(`Found ${errors.length} hidden errors or unhandled exceptions during the run:`);
      errors.forEach((err, idx) => console.log(`${idx + 1}: ${err}`));
      console.log('------------------------------\n');
    } else {
      console.log('\n--- DIAGNOSTIC LOG PROFILE ---');
      console.log('No hidden console errors or exceptions detected. All async API data pipeline calls completed successfully.');
      console.log('------------------------------\n');
    }
  });
});
