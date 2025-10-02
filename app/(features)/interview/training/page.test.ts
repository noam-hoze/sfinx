import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("/interview/training page", () => {
    it("exports a default React component", async () => {
        const mod = await import("./page");
        expect(typeof mod.default).toBe("function");
    });

    it("uses AuthGuard with COMPANY role", () => {
        const filePath = resolve(__dirname, "./page.tsx");
        const src = readFileSync(filePath, "utf-8");
        expect(src).toContain("AuthGuard");
        expect(src).toContain('requiredRole="COMPANY"');
        expect(src).toContain("<InterviewIDE />");
    });
});
