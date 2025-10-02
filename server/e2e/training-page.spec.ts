import { test, expect } from "@playwright/test";

test.describe("Company can access /interview/training", () => {
    test("login as company and visit training", async ({ page }) => {
        const email = "manager@meta.com";
        const password = "sfinx";

        // Login
        await page.goto("/login");
        await page.fill('input[type="email"]', email);
        await page.fill('input[type="password"]', password);
        await page.click('button[type="submit"]');

        // Wait for role-based redirect to company dashboard
        await page.waitForURL(/\/company-dashboard/);

        // Navigate to training page with explicit companyId
        await page.goto("/interview/training?companyId=meta");

        // Wait for the training page to load and show content
        await page.waitForSelector("text=Front-end Developer", {
            timeout: 10000,
        });

        // Post a mock code edit to the page and verify buffer updates
        await page.evaluate(() => {
            window.postMessage(
                {
                    type: "training-apply-edits",
                    edits: [
                        {
                            file: "app/(features)/interview/components/editor/EditorPanel.tsx",
                            range: { start: 0, end: 0 },
                            replacement: "",
                        },
                    ],
                },
                "*"
            );
        });
        // Assert the handler ran (we set a data attribute after applying)
        await expect(page.locator("body")).toHaveAttribute(
            "data-training-applied",
            "true"
        );
    });
});
