import { test, expect } from "@playwright/test";

test.describe("Home Page", () => {
  test("has correct title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Golden Minutes/);
  });

  test("renders the heading", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      /Write notes like normal/i,
    );
  });
});

test.describe("Public Pages", () => {
  const publicRoutes = [
    { path: "/pricing", heading: "Simple, transparent pricing" },
    { path: "/privacy", heading: "Privacy Policy" },
    { path: "/terms", heading: "Terms of Service" },
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
