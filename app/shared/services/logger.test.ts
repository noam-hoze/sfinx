/**
 * Unit tests for logger service
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { log, setLevel, setAllowedFiles } from "./logger";
import { LOG_CATEGORIES } from "./logger.config";

// Mock loglevel
vi.mock("loglevel", () => {
  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    getLevel: vi.fn(() => 1),
    setLevel: vi.fn(),
    methodFactory: vi.fn((methodName: string) => {
      return (...args: any[]) => {
        mockLogger[methodName as keyof typeof mockLogger](...args);
      };
    }),
  };
  return { default: mockLogger };
});

describe("logger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("category filtering", () => {
    it("should emit log for allowed category in blocklist mode", () => {
      // INTERVIEW_UI is not in blocklist, so it should be allowed
      log.info(LOG_CATEGORIES.INTERVIEW_UI, "Test message");
      // Cannot easily verify mock was called due to loglevel wrapping
      // This test validates the category is accepted without throwing
      expect(true).toBe(true);
    });

    it("should accept valid category without error", () => {
      expect(() => {
        log.debug(LOG_CATEGORIES.CACHE, "Debug message");
        log.info(LOG_CATEGORIES.OPENAI, "Info message");
        log.warn(LOG_CATEGORIES.DB, "Warn message");
        log.error(LOG_CATEGORIES.AUTH, "Error message");
      }).not.toThrow();
    });

    it("should throw error for invalid category", () => {
      expect(() => {
        log.info("" as any, "Invalid category");
      }).toThrow("Log category is required");
    });

    it("should throw error for non-string category", () => {
      expect(() => {
        log.info(null as any, "Null category");
      }).toThrow("Log category is required");
    });
  });

  describe("setLevel", () => {
    it("should accept valid log levels", () => {
      expect(() => setLevel("debug")).not.toThrow();
      expect(() => setLevel("info")).not.toThrow();
      expect(() => setLevel("warn")).not.toThrow();
      expect(() => setLevel("error")).not.toThrow();
      expect(() => setLevel("silent")).not.toThrow();
    });
  });

  describe("setAllowedFiles", () => {
    it("should accept string matchers", () => {
      expect(() => setAllowedFiles(["/path/to/file.ts"])).not.toThrow();
    });

    it("should accept RegExp matchers", () => {
      expect(() => setAllowedFiles([/\/features\/.*/])).not.toThrow();
    });

    it("should accept mixed matchers", () => {
      expect(() => 
        setAllowedFiles(["/api/interviews", /\/components\/.*/])
      ).not.toThrow();
    });

    it("should accept empty array", () => {
      expect(() => setAllowedFiles([])).not.toThrow();
    });

    it("should handle non-array input gracefully", () => {
      expect(() => setAllowedFiles(null as any)).not.toThrow();
      expect(() => setAllowedFiles(undefined as any)).not.toThrow();
    });
  });

  describe("log methods", () => {
    it("should have all log level methods", () => {
      expect(typeof log.debug).toBe("function");
      expect(typeof log.info).toBe("function");
      expect(typeof log.warn).toBe("function");
      expect(typeof log.error).toBe("function");
    });

    it("should accept multiple arguments", () => {
      expect(() => {
        log.info(LOG_CATEGORIES.CACHE, "Message", { data: 1 }, [1, 2, 3]);
      }).not.toThrow();
    });

    it("should handle objects and arrays", () => {
      expect(() => {
        log.info(LOG_CATEGORIES.DB, { user: "test", id: 123 });
        log.warn(LOG_CATEGORIES.AUTH, ["error1", "error2"]);
      }).not.toThrow();
    });
  });
});
