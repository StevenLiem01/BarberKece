import { test, expect } from "@playwright/test";
import {
  createTestCustomer,
  createTestStaff,
  createResetTokenForUser,
  cleanupExactIds,
  generateTestEmail,
} from "./fixtures/auth.fixture";

test.describe("M1 Auth Journeys", () => {
  // Each worker cleans up its own explicitly tracked exact IDs
  test.afterAll(async () => {
    await cleanupExactIds();
  });

  test("Register -> Login -> Logout Journey", async ({ page }) => {
    const email = generateTestEmail();
    const password = "Password123!";

    // 1. Register via UI
    await page.goto("/sign-up");
    await page.fill("#email", email);
    await page.fill("#password", password);
    await page.click('button[type="submit"]');

    // 2. Redirect to /sign-in success state, no auto-login
    await expect(page).toHaveURL(/\/sign-in\?registered=true/);

    // Verify no authenticated session exists yet by trying to visit /account
    await page.goto("/account");
    await expect(page).toHaveURL(/\/sign-in/);

    // 3. Sign in with newly registered credentials
    await page.goto("/sign-in");
    await page.fill("#email", email);
    await page.fill("#password", password);
    await page.click('button[type="submit"]');

    // 4. Verify /account becomes accessible
    await expect(page).toHaveURL(/\/account/);

    // Ensure session cookie exists
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) => c.name === "barberkece_session");
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie?.httpOnly).toBe(true);

    // 5. Click Logout
    await page.click('button:has-text("Log out")');

    // 6. Redirect to /sign-in
    await expect(page).toHaveURL(/\/sign-in/);

    // 7. Attempt direct access to /account and verify it is protected again
    await page.goto("/account");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("Invalid Login Journey", async ({ page }) => {
    await page.goto("/sign-in");
    await page.fill("#email", "nonexistent@example.com");
    await page.fill("#password", "WrongPassword123!");
    await page.click('button[type="submit"]');

    // Assert generic public error is shown (no enumeration)
    await expect(page.locator("text=Invalid email or password")).toBeVisible();

    // Assert no session cookie is created
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) => c.name === "barberkece_session");
    expect(sessionCookie).toBeUndefined();
  });

  test("Unauth Protected Routes Journey", async ({ page }) => {
    // Navigate directly to protected routes unauthenticated
    const routes = ["/account", "/barber", "/admin"];
    for (const route of routes) {
      await page.goto(route);
      await expect(page).toHaveURL(
        new RegExp(`/sign-in\\?next=${encodeURIComponent(route)}|/sign-in`),
      );
    }
  });

  test("Role Routing (BARBER) Journey", async ({ page }) => {
    const barber = await createTestStaff("BARBER");

    await page.goto("/sign-in");
    await page.fill("#email", barber.email);
    await page.fill("#password", barber.password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/barber/);
  });

  test("Role Routing (ADMIN) Journey", async ({ page }) => {
    const admin = await createTestStaff("ADMIN");

    await page.goto("/sign-in");
    await page.fill("#email", admin.email);
    await page.fill("#password", admin.password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/admin/);
  });

  test("`next` Redirect Journey", async ({ page }) => {
    const customer = await createTestCustomer();

    await page.goto("/sign-in?next=/account/settings");
    await page.fill("#email", customer.email);
    await page.fill("#password", customer.password);
    await page.click('button[type="submit"]');

    // Should route to the target next path
    await expect(page).toHaveURL(/\/account\/settings/);
  });

  test("Forgot-password Enumeration E2E", async ({ page }) => {
    const customer = await createTestCustomer();
    const unknownEmail = generateTestEmail();

    // Known email
    await page.goto("/forgot-password");
    await page.fill("#email", customer.email);
    await page.click('button[type="submit"]');
    await expect(
      page.locator("text=If an account exists for that email"),
    ).toBeVisible();

    // Unknown email
    await page.goto("/forgot-password");
    await page.fill("#email", unknownEmail);
    await page.click('button[type="submit"]');
    // Must produce exactly identical public success state
    await expect(
      page.locator("text=If an account exists for that email"),
    ).toBeVisible();
  });

  test("Invalid Token Reset Journey", async ({ page }) => {
    await page.goto("/reset-password?token=invalid_string");
    await page.fill("#newPassword", "NewPassword123!");
    await page.click('button[type="submit"]');

    await expect(
      page.locator("text=Invalid or expired password reset token"),
    ).toBeVisible();
  });
});

test.describe("M1 Stateful Multi-Context Journeys", () => {
  test.afterAll(async () => {
    await cleanupExactIds();
  });

  test("Session Revocation and Old/New Password Proof", async ({ browser }) => {
    // We combine these as requested to optimize execution
    const customer = await createTestCustomer("OldPassword123!");

    // Context A
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await pageA.goto("/sign-in");
    await pageA.fill("#email", customer.email);
    await pageA.fill("#password", customer.password);
    await pageA.click('button[type="submit"]');
    await expect(pageA).toHaveURL(/\/account/);

    // Context B
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await pageB.goto("/sign-in");
    await pageB.fill("#email", customer.email);
    await pageB.fill("#password", customer.password);
    await pageB.click('button[type="submit"]');
    await expect(pageB).toHaveURL(/\/account/);

    // Generate valid reset token
    const token = await createResetTokenForUser(customer.id);
    const newPassword = "NewPassword123!";

    // Context C (Unauth) for Reset Confirmation
    const contextC = await browser.newContext();
    const pageC = await contextC.newPage();
    await pageC.goto(`/reset-password?token=${token.rawToken}`);
    await pageC.fill("#newPassword", newPassword);
    await pageC.click('button[type="submit"]');

    // Assert successful submission, redirect to /sign-in
    await expect(pageC).toHaveURL(/\/sign-in/);
    // Assert no auto-login in context C
    const cookiesC = await contextC.cookies();
    expect(
      cookiesC.find((c) => c.name === "barberkece_session"),
    ).toBeUndefined();

    // Verify ALL-session revocation
    await pageA.reload();
    await expect(pageA).toHaveURL(/\/sign-in/);
    await pageB.reload();
    await expect(pageB).toHaveURL(/\/sign-in/);

    // Old Password Proof (Context D)
    const contextD = await browser.newContext();
    const pageD = await contextD.newPage();
    await pageD.goto("/sign-in");
    await pageD.fill("#email", customer.email);
    await pageD.fill("#password", customer.password); // Old password
    await pageD.click('button[type="submit"]');
    await expect(pageD.locator("text=Invalid email or password")).toBeVisible();

    // New Password Proof (Context E)
    const contextE = await browser.newContext();
    const pageE = await contextE.newPage();
    await pageE.goto("/sign-in");
    await pageE.fill("#email", customer.email);
    await pageE.fill("#password", newPassword);
    await pageE.click('button[type="submit"]');
    await expect(pageE).toHaveURL(/\/account/);
  });
});
