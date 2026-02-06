import { test, expect } from "@playwright/test";

test.describe("Home Page", () => {
  test("has correct title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/AINotes/);
  });

  test("renders the heading", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("AINotes");
  });
});

test.describe("Public Pages", () => {
  const publicRoutes = [
    { path: "/pricing", heading: "Pricing" },
    { path: "/privacy", heading: "Privacy Policy" },
    { path: "/terms", heading: "Terms and Conditions" },
    { path: "/cookies", heading: "Cookie Policy" },
    { path: "/contact", heading: "Contact Us" },
  ];

  for (const route of publicRoutes) {
    test(`${route.path} loads and has correct heading`, async ({ page }) => {
      await page.goto(route.path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        route.heading,
      );
    });
  }
});
