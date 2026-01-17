/**
 * Unit tests for interview constants
 */

import { describe, it, expect } from "vitest";
import { CONTRIBUTIONS_TARGET } from "./interview";

describe("interview constants", () => {
  it("should export CONTRIBUTIONS_TARGET", () => {
    expect(CONTRIBUTIONS_TARGET).toBeDefined();
    expect(typeof CONTRIBUTIONS_TARGET).toBe("number");
  });

  it("should have CONTRIBUTIONS_TARGET as positive number", () => {
    expect(CONTRIBUTIONS_TARGET).toBeGreaterThan(0);
  });
});
