import { defineConfig } from "@playwright/test";

export default defineConfig({
    testDir: "./server/e2e",
    use: {
        baseURL: "http://localhost:3000",
        headless: true,
        trace: "on-first-retry",
    },
    projects: [
        { name: "chromium", use: { browserName: "chromium" } },
        { name: "firefox", use: { browserName: "firefox" } },
        { name: "webkit", use: { browserName: "webkit" } },
    ],
});
