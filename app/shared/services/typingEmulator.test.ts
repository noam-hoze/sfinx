import { describe, it, expect } from "vitest";
import {
    expandEditToKeystrokes,
    applyKeystrokesToText,
    fastForwardApplyEdits,
} from "./typingEmulator";

describe("typingEmulator", () => {
    it("expands and applies a single edit", () => {
        const before = "hello world";
        const ops = expandEditToKeystrokes(before, {
            file: "index.ts",
            range: { start: 6, end: 11 },
            replacement: "sfinx",
        });
        const after = applyKeystrokesToText(before, 6, ops);
        expect(after).toBe("hello sfinx");
    });

    it("applies multiple edits in order with offsets", () => {
        const before = "abc123xyz";
        const after = fastForwardApplyEdits(before, [
            { file: "f.ts", range: { start: 3, end: 6 }, replacement: "-" }, // abc-xyz
            { file: "f.ts", range: { start: 0, end: 3 }, replacement: "ABC" }, // ABC-xyz
        ]);
        expect(after).toBe("ABC-xyz");
    });
});
