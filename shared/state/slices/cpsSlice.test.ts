/**
 * Unit tests for cpsSlice
 */

import { describe, it, expect } from "vitest";
import cpsReducer, {
  setActiveEvidenceTimestamp,
  setActiveEvidenceKey,
  setActiveCaption,
} from "./cpsSlice";

describe("cpsSlice", () => {
  describe("reducers", () => {
    it("should return initial state", () => {
      const state = cpsReducer(undefined, { type: "@@INIT" });
      expect(state).toEqual({
        activeEvidenceTimestamp: null,
        activeEvidenceKey: null,
        activeCaption: null,
      });
    });

    it("should handle setActiveEvidenceTimestamp", () => {
      const timestamp = Date.now();
      const state = cpsReducer(
        undefined,
        setActiveEvidenceTimestamp(timestamp)
      );
      expect(state.activeEvidenceTimestamp).toBe(timestamp);
    });

    it("should handle setActiveEvidenceTimestamp with null", () => {
      const state = cpsReducer(
        { activeEvidenceTimestamp: 12345, activeEvidenceKey: null, activeCaption: null },
        setActiveEvidenceTimestamp(null)
      );
      expect(state.activeEvidenceTimestamp).toBeNull();
    });

    it("should handle setActiveEvidenceKey", () => {
      const key = "test-label-12345-0";
      const state = cpsReducer(
        undefined,
        setActiveEvidenceKey(key)
      );
      expect(state.activeEvidenceKey).toBe(key);
    });

    it("should handle setActiveEvidenceKey with null", () => {
      const state = cpsReducer(
        { activeEvidenceTimestamp: null, activeEvidenceKey: "old-key", activeCaption: null },
        setActiveEvidenceKey(null)
      );
      expect(state.activeEvidenceKey).toBeNull();
    });

    it("should handle setActiveCaption", () => {
      const caption = "Test caption text";
      const state = cpsReducer(
        undefined,
        setActiveCaption(caption)
      );
      expect(state.activeCaption).toBe(caption);
    });

    it("should handle setActiveCaption with null", () => {
      const state = cpsReducer(
        { activeEvidenceTimestamp: null, activeEvidenceKey: null, activeCaption: "old" },
        setActiveCaption(null)
      );
      expect(state.activeCaption).toBeNull();
    });

    it("should handle multiple actions sequentially", () => {
      let state = cpsReducer(undefined, setActiveEvidenceTimestamp(12345));
      state = cpsReducer(state, setActiveEvidenceKey("key-1"));
      state = cpsReducer(state, setActiveCaption("caption-1"));

      expect(state).toEqual({
        activeEvidenceTimestamp: 12345,
        activeEvidenceKey: "key-1",
        activeCaption: "caption-1",
      });
    });
  });
});
