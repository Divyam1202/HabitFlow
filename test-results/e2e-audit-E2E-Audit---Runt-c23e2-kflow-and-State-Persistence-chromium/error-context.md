# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e-audit.spec.ts >> E2E Audit - Runtime Bugs and Layout Failures >> User Creation Workflow and State Persistence
- Location: tests\e2e-audit.spec.ts:12:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
Call log:
  - navigating to "http://localhost:3000/", waiting until "domcontentloaded"

```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.describe('E2E Audit - Runtime Bugs and Layout Failures', () => {
  4   |   // Use unique mock data for each run
  5   |   const timestamp = Date.now();
  6   |   const mockUser = {
  7   |     email: `test_user_${timestamp}@example.com`,
  8   |     username: `testuser_${timestamp}`,
  9   |     password: `TestP@ssw0rd${timestamp}`
  10  |   };
  11  | 
  12  |   test('User Creation Workflow and State Persistence', async ({ page }) => {
  13  |     // Target Initialization:
  14  |     // Viewport is configured to 1920x1080 in playwright config or context
  15  |     // The test runner isolates cookies/sessions by default per context.
  16  | 
  17  |     // Network & Error Observers
  18  |     const errors: string[] = [];
  19  |     page.on('console', msg => {
  20  |       if (msg.type() === 'error') {
  21  |         const text = msg.text();
  22  |         console.error(`[Browser Console Error]: ${text}`);
  23  |         errors.push(text);
  24  |       }
  25  |     });
  26  | 
  27  |     page.on('pageerror', exception => {
  28  |       console.error(`[Unhandled Exception]: ${exception.message}`);
  29  |       errors.push(exception.message);
  30  |     });
  31  | 
  32  |     // 1. Navigate directly to the deployment URL.
  33  |     // Replace with the production link if needed
  34  |     const targetUrl = process.env.BASE_URL || 'http://localhost:3000';
> 35  |     await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
      |                ^ Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
  36  | 
  37  |     // 2. Locate the signup inputs and trigger registration
  38  |     // Check if we need to click the "INITIALIZE YOUR JOURNEY" start tracking button
  39  |     const initializeBtn = page.getByRole('button', { name: /start tracking/i });
  40  |     if (await initializeBtn.isVisible()) {
  41  |       await initializeBtn.click();
  42  |     } else {
  43  |       // If it doesn't show up, try clicking the top nav Sign In/Up
  44  |       const authTrigger = page.locator('button').filter({ hasText: 'SIGN' });
  45  |       if (await authTrigger.isVisible()) {
  46  |         await authTrigger.click();
  47  |       }
  48  |     }
  49  | 
  50  |     // Wait for gatekeeper modal
  51  |     await page.waitForSelector('text="Authentication Required"');
  52  | 
  53  |     // Switch to Sign Up tab
  54  |     await page.getByRole('button', { name: 'Sign Up' }).click();
  55  | 
  56  |     // Fill mock staging data
  57  |     await page.getByLabel(/Email/i).fill(mockUser.email);
  58  |     await page.getByLabel(/Username/i).fill(mockUser.username);
  59  |     await page.getByLabel(/Password/i).fill(mockUser.password);
  60  | 
  61  |     // Trigger registration click event loop
  62  |     const submitBtn = page.getByRole('button', { name: 'Create Account' });
  63  |     await expect(submitBtn).toBeEnabled();
  64  |     await submitBtn.click();
  65  | 
  66  |     // Wait for the authentication state response hook to pass successfully
  67  |     // (We disabled OTP for local test, so it should redirect or show success directly)
  68  |     await expect(page.locator('text="Access Granted"')).toBeVisible({ timeout: 15000 });
  69  |     
  70  |     // Wait for the dashboard view to load (gatekeeper modal closes)
  71  |     await page.waitForSelector('text="Access Granted"', { state: 'hidden' });
  72  |     await expect(page.locator('text="MANAGE HABITS"').or(page.locator('text="DASHBOARD"'))).toBeVisible();
  73  | 
  74  |     // State Persistence & Forced Hard Refresh Test:
  75  |     // Once the dashboard view state triggers, capture an initial screen artifact trace
  76  |     await page.screenshot({ path: 'dashboard-initial.png', fullPage: true });
  77  | 
  78  |     // Execute a standard page reload to stress-test frontend state persistence
  79  |     await page.reload();
  80  | 
  81  |     // Verify that the user session does not crash or drop back out to auth gate screen
  82  |     const isGatekeeperVisible = await page.locator('text="Authentication Required"').isVisible();
  83  |     expect(isGatekeeperVisible).toBe(false);
  84  | 
  85  |     // Post-Load Validation Capture:
  86  |     await page.screenshot({ path: 'dashboard-post-refresh.png', fullPage: true });
  87  | 
  88  |     // Output a comprehensive diagnostic log profile if there were errors
  89  |     if (errors.length > 0) {
  90  |       console.log('\n--- DIAGNOSTIC LOG PROFILE ---');
  91  |       console.log(`Found ${errors.length} hidden errors or unhandled exceptions during the run:`);
  92  |       errors.forEach((err, idx) => console.log(`${idx + 1}: ${err}`));
  93  |       console.log('------------------------------\n');
  94  |     } else {
  95  |       console.log('\n--- DIAGNOSTIC LOG PROFILE ---');
  96  |       console.log('No hidden console errors or exceptions detected. All async API data pipeline calls completed successfully.');
  97  |       console.log('------------------------------\n');
  98  |     }
  99  |   });
  100 | });
  101 | 
```