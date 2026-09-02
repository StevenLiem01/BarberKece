import { expect, test } from "@playwright/test";

test.describe("BarberKece Web Smoke Test", () => {
  test("homepage loads and displays brand heading and platform title", async ({
    page,
  }) => {
    await page.goto("/");

    // Verify document title
    await expect(page).toHaveTitle(/BarberKece/i);

    // Verify main brand heading is visible
    const heading = page.getByRole("heading", {
      level: 1,
      name: /BarberKece/i,
    });
    await expect(heading).toBeVisible();

    // Verify development platform descriptor text
    const description = page.getByText(
      /Personalized Digital Barbershop Platform/i,
    );
    await expect(description).toBeVisible();
  });
});
