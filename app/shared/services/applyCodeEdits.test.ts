import { describe, it, expect } from "vitest";
import { applyCodeEditsSafely } from "./applyCodeEdits";

describe("applyCodeEditsSafely", () => {
    it("applies valid edits and rejects out-of-range", () => {
        const before = "hello world";
        const ok = applyCodeEditsSafely(
            before,
            [
                {
                    file: "f.ts",
                    range: { start: 6, end: 11 },
                    replacement: "sfinx",
                },
            ],
            { allowlist: ["f.ts"] }
        );
        expect(ok.ok).toBe(true);
        // @ts-expect-error narrowing
        expect(ok.text).toBe("hello sfinx");

        const bad = applyCodeEditsSafely(
            before,
            [{ file: "f.ts", range: { start: 50, end: 60 }, replacement: "x" }],
            { allowlist: ["f.ts"] }
        );
        expect(bad.ok).toBe(false);

        const notAllowed = applyCodeEditsSafely(
            before,
            [
                {
                    file: "not-allowed.ts",
                    range: { start: 0, end: 0 },
                    replacement: "x",
                },
            ],
            { allowlist: ["f.ts"] }
        );
        expect(notAllowed.ok).toBe(false);
    });
});
