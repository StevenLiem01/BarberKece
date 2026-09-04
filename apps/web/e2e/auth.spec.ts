import { test, expect } from "@playwright/test";

test.describe("Auth UI & Forms", () => {
  test("Sign In page renders and validates input client-side", async ({
    page,
  }) => {
    await page.goto("/sign-in");

    // Renders correctly
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();

    // Client-side validation triggers on empty submit
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Invalid email format")).toBeVisible();
    await expect(page.getByText("Password is required")).toBeVisible();
  });

  test("Sign In handles server authentication failure safely", async ({
    page,
  }) => {
    // Intercept the API call to return 401
    await page.route("**/api/v1/auth/login", async (route) => {
      await route.fulfill({
        status: 401,
        json: {
          error: {
            code: "AUTHENTICATION_FAILED",
            message: "Invalid email or password",
          },
        },
      });
    });

    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("wrong@example.com");
    await page.getByLabel("Password").fill("wrongpassword");
    await page.getByRole("button", { name: "Sign in" }).click();

    // Expect generic enumeration-safe error
    await expect(page.getByText("Invalid email or password")).toBeVisible();
  });

  test("Sign Up page renders and validates input client-side", async ({
    page,
  }) => {
    await page.goto("/sign-up");

    await expect(
      page.getByRole("heading", { name: "Create an account" }),
    ).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign up" })).toBeVisible();

    // Trigger validation
    await page.getByLabel("Password").fill("short");
    await page.getByRole("button", { name: "Sign up" }).click();
    await expect(page.getByText("Invalid email format")).toBeVisible();
    await expect(
      page.getByText("Password must be at least 8 characters long"),
    ).toBeVisible();
  });

  test("Forgot Password page renders and validates input", async ({ page }) => {
    await page.goto("/forgot-password");

    await expect(
      page.getByRole("heading", { name: "Reset password" }),
    ).toBeVisible();
    await expect(page.getByLabel("Email address")).toBeVisible();

    // Trigger validation
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText("Invalid email format")).toBeVisible();
  });

  test("Reset Password page renders error when token is missing", async ({
    page,
  }) => {
    await page.goto("/reset-password");

    await expect(
      page.getByRole("heading", { name: "Choose new password" }),
    ).toBeVisible();
    await expect(page.getByText("Missing reset token")).toBeVisible();
  });

  test("Reset Password page renders form when token is present and validates", async ({
    page,
  }) => {
    await page.goto("/reset-password?token=mock-token");

    await expect(page.getByLabel("New Password")).toBeVisible();

    // Trigger validation
    await page.getByRole("button", { name: "Reset password" }).click();
    await expect(
      page.getByText("Password must be at least 8 characters long"),
    ).toBeVisible();
  });

  test("Logout button triggers API and redirects to sign in", async ({
    page,
    request,
  }) => {
    const uniqueEmail = `test-logout-${Date.now()}@example.com`;

    const res = await request.post("/api/v1/auth/register", {
      data: { email: uniqueEmail, password: "password123" },
      headers: {
        Origin: "http://localhost:3000",
      },
    });

    if (!res.ok()) {
      console.log("Registration failed:", await res.text());
    }
    expect(res.ok()).toBeTruthy();

    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(uniqueEmail);
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/account/, { timeout: 15000 });

    await page.getByRole("button", { name: "Log out" }).click();

    await expect(page).toHaveURL(/\/sign-in/, { timeout: 15000 });
  });
});
