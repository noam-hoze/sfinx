import { describe, it, expect } from "vitest";
import {
    computeHash,
    verifyApplyContract,
    mintNextVersionId,
} from "./versioning";

describe("versioning", () => {
    it("computes a stable hash and verifies contract", () => {
        const text = "hello";
        const h = computeHash(text);
        const res = verifyApplyContract("v1", h, "v1", text);
        expect(res).toEqual({ ok: true });

        const bad = verifyApplyContract("v2", h, "v1", text);
        expect(bad.ok).toBe(false);
    });

    it("mints next version id", () => {
        expect(mintNextVersionId("v1")).toBe("v2");
        expect(mintNextVersionId("alpha")).toBe("alpha-1");
    });
});
