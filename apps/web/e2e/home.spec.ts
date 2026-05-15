import { test, expect } from "@playwright/test";

test.describe("Landing page (unauthenticated)", () => {
  test("shows app title and sign-in buttons", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "AI Fullstack Starter" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in with GitHub" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
  });

  test("does not show the chat UI when logged out", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByPlaceholder("Ask anything...")).not.toBeVisible();
  });
});
