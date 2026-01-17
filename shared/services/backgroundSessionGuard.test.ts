/**
 * Unit tests for backgroundSessionGuard
 */

import { describe, it, expect } from "vitest";
import {
  nowMs,
  ensureTimerStarted,
  elapsedMs,
  formatCountdown,
  shouldTransition,
  TIMEBOX_MS,
  type GuardState,
  type CategoryConfidence,
} from "./backgroundSessionGuard";

describe("backgroundSessionGuard", () => {
  describe("nowMs", () => {
    it("should return current timestamp", () => {
      const now = nowMs();
      expect(typeof now).toBe("number");
      expect(now).toBeGreaterThan(0);
    });
  });

  describe("ensureTimerStarted", () => {
    it("should start timer if not started", () => {
      const gs: GuardState = {};
      const clockMs = 1000;
      const result = ensureTimerStarted(gs, clockMs);
      expect(result.startedAtMs).toBe(clockMs);
    });

    it("should not restart timer if already started", () => {
      const gs: GuardState = { startedAtMs: 500 };
      const result = ensureTimerStarted(gs, 1000);
      expect(result.startedAtMs).toBe(500);
    });
  });

  describe("elapsedMs", () => {
    it("should return 0 if timer not started", () => {
      const gs: GuardState = {};
      expect(elapsedMs(gs, 1000)).toBe(0);
    });

    it("should calculate elapsed time", () => {
      const gs: GuardState = { startedAtMs: 1000 };
      expect(elapsedMs(gs, 3000)).toBe(2000);
    });

    it("should return 0 for negative elapsed time", () => {
      const gs: GuardState = { startedAtMs: 5000 };
      expect(elapsedMs(gs, 3000)).toBe(0);
    });
  });

  describe("formatCountdown", () => {
    it("should format minutes and seconds", () => {
      expect(formatCountdown(90000)).toBe("1:30");
      expect(formatCountdown(125000)).toBe("2:05");
      expect(formatCountdown(3661000)).toBe("61:01");
    });

    it("should handle zero", () => {
      expect(formatCountdown(0)).toBe("0:00");
    });

    it("should handle negative values", () => {
      expect(formatCountdown(-1000)).toBe("0:00");
    });
  });

  describe("shouldTransition", () => {
    it("should return null when no condition met", () => {
      const gs: GuardState = { startedAtMs: 1000 };
      const result = shouldTransition(gs, { clockMs: 2000 });
      expect(result).toBeNull();
    });

    it("should return timebox when limit exceeded", () => {
      const gs: GuardState = { startedAtMs: 1000 };
      const result = shouldTransition(gs, {
        clockMs: 1000 + TIMEBOX_MS + 100,
      });
      expect(result).toBe("timebox");
    });

    it("should use custom timeboxMs", () => {
      const gs: GuardState = { startedAtMs: 1000 };
      const result = shouldTransition(gs, {
        clockMs: 2000,
        timeboxMs: 500,
      });
      expect(result).toBe("timebox");
    });

    it("should return all_topics_complete when all categories complete", () => {
      const categories: CategoryConfidence[] = [
        { name: "cat1", confidence: 90, avgStrength: 100 },
        { name: "cat2", confidence: 85, avgStrength: 100 },
      ];
      const gs: GuardState = { startedAtMs: 1000 };
      const result = shouldTransition(gs, { clockMs: 2000, categories });
      expect(result).toBe("all_topics_complete");
    });

    it("should not complete when some categories incomplete", () => {
      const categories: CategoryConfidence[] = [
        { name: "cat1", confidence: 90, avgStrength: 100 },
        { name: "cat2", confidence: 85, avgStrength: 50 },
      ];
      const gs: GuardState = { startedAtMs: 1000 };
      const result = shouldTransition(gs, { clockMs: 2000, categories });
      expect(result).toBeNull();
    });

    it("should prioritize all_topics_complete over timebox", () => {
      // Both conditions met - should return all_topics_complete first
      const categories: CategoryConfidence[] = [
        { name: "cat1", confidence: 100, avgStrength: 100 },
        { name: "cat2", confidence: 100, avgStrength: 100 },
      ];
      const gs: GuardState = { startedAtMs: 1000 };
      const result = shouldTransition(gs, {
        clockMs: 1000 + TIMEBOX_MS + 1000, // Timebox exceeded
        categories,
      });
      expect(result).toBe("all_topics_complete");
    });

    it("should use state timeboxMs over options timeboxMs", () => {
      const gs: GuardState = { startedAtMs: 1000, timeboxMs: 300 };
      const result = shouldTransition(gs, {
        clockMs: 1400,
        timeboxMs: 1000, // Options value is higher
      });
      expect(result).toBe("timebox"); // State value (300) causes transition
    });

    it("should fall back to options timeboxMs when state has none", () => {
      const gs: GuardState = { startedAtMs: 1000 };
      const result = shouldTransition(gs, {
        clockMs: 1400,
        timeboxMs: 300,
      });
      expect(result).toBe("timebox");
    });

    it("should fall back to TIMEBOX_MS when neither state nor options provide valid timebox", () => {
      const gs: GuardState = { startedAtMs: 1000, timeboxMs: -100 }; // Invalid
      const result = shouldTransition(gs, {
        clockMs: 1000 + TIMEBOX_MS + 100,
        timeboxMs: 0, // Invalid
      });
      expect(result).toBe("timebox");
    });

    it("should handle empty categories array", () => {
      const gs: GuardState = { startedAtMs: 1000 };
      const result = shouldTransition(gs, {
        clockMs: 2000,
        categories: [],
      });
      expect(result).toBeNull();
    });

    it("should not transition when categories exist but not all complete", () => {
      const categories: CategoryConfidence[] = [
        { name: "cat1", confidence: 100, avgStrength: 100 },
        { name: "cat2", confidence: 80, avgStrength: 99 }, // Not complete
      ];
      const gs: GuardState = { startedAtMs: 1000 };
      const result = shouldTransition(gs, { clockMs: 2000, categories });
      expect(result).toBeNull();
    });
  });

  describe("formatCountdown edge cases", () => {
    it("should handle very large times", () => {
      expect(formatCountdown(3600000)).toBe("60:00"); // 1 hour
      expect(formatCountdown(7200000)).toBe("120:00"); // 2 hours
    });

    it("should handle fractional seconds", () => {
      expect(formatCountdown(1500)).toBe("0:01"); // 1.5s rounds down
      expect(formatCountdown(999)).toBe("0:00"); // <1s shows as 0:00
    });
  });

  describe("elapsedMs edge cases", () => {
    it("should handle very large elapsed times", () => {
      const gs: GuardState = { startedAtMs: 1000 };
      expect(elapsedMs(gs, 1000000)).toBe(999000);
    });

    it("should handle exact same time", () => {
      const gs: GuardState = { startedAtMs: 5000 };
      expect(elapsedMs(gs, 5000)).toBe(0);
    });
  });
});
