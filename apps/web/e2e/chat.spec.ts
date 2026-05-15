import { test, expect } from "@playwright/test";

const FAKE_SSE =
  'data: {"text":"Hello from AI!"}\n\n' +
  'data: {"done":true,"usage":{"input":10,"output":5,"cacheRead":0}}\n\n';

test.describe("Chat UI", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("/api/chat", (route) =>
      route.fulfill({
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
        body: FAKE_SSE,
      }),
    );
    await page.goto("/e2e-chat-test");
  });

  test("shows empty state placeholder", async ({ page }) => {
    await expect(page.getByText("Start a conversation with Claude")).toBeVisible();
  });

  test("sends a message and renders the response", async ({ page }) => {
    const input = page.getByPlaceholder("Ask anything...");
    await input.fill("Hi there");
    await page.getByRole("button", { name: "Send" }).click();

    await expect(page.getByText("Hi there")).toBeVisible();
    await expect(page.getByText("Hello from AI!")).toBeVisible();
  });

  test("Send button is disabled while streaming", async ({ page }) => {
    // Delay the mock response so we can assert the loading state.
    await page.unroute("/api/chat");
    await page.route("/api/chat", async (route) => {
      await new Promise((r) => setTimeout(r, 300));
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        body: FAKE_SSE,
      });
    });

    const input = page.getByPlaceholder("Ask anything...");
    await input.fill("test");
    await page.getByRole("button", { name: "Send" }).click();

    await expect(page.getByRole("button", { name: "..." })).toBeDisabled();
    await expect(page.getByText("Hello from AI!")).toBeVisible();
  });

  test("sends message on Enter key", async ({ page }) => {
    const input = page.getByPlaceholder("Ask anything...");
    await input.fill("Enter test");
    await input.press("Enter");

    await expect(page.getByText("Enter test")).toBeVisible();
    await expect(page.getByText("Hello from AI!")).toBeVisible();
  });
});
