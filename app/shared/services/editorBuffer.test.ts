import { describe, it, expect } from "vitest";
import { EditorBufferManager } from "./editorBuffer";
import { computeHash } from "./versioning";

describe("EditorBufferManager", () => {
    it("applies edits with versioning and allowlist", () => {
        const buf = new EditorBufferManager("hello world", "v1", ["f.ts"]);
        const res = buf.tryApply({
            versionId: "v1",
            beforeHash: computeHash("hello world"),
            edits: [
                {
                    file: "f.ts",
                    range: { start: 6, end: 11 },
                    replacement: "sfinx",
                },
            ],
        });
        expect(res.ok).toBe(true);
        // @ts-expect-error narrowing
        expect(res.text).toBe("hello sfinx");
        expect(buf.currentVersion).toBe("v2");

        const badFile = buf.tryApply({
            versionId: buf.currentVersion,
            beforeHash: buf.currentHash,
            edits: [
                {
                    file: "not.ts",
                    range: { start: 0, end: 0 },
                    replacement: "x",
                },
            ],
        });
        expect(badFile.ok).toBe(false);
    });
});
