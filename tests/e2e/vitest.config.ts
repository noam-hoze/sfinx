/**
 * @file Vitest configuration for end-to-end smoke coverage.
 */
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
    test: {
        dir: path.resolve(__dirname),
        include: ["**/*.spec.ts", "**/*.spec.tsx"],
        environment: "node",
        globals: true,
        testTimeout: 120_000,
        hookTimeout: 120_000,
    },
    resolve: {
        alias: {
            app: path.resolve(__dirname, "../../app"),
            "@/shared": path.resolve(__dirname, "../../shared"),
        },
    },
});
