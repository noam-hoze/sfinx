/**
 * Unit tests for audioCache utility
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  cacheAudio,
  getCachedAudio,
  cacheBlob,
  getCachedBlob,
  clearAudioCache,
} from "./audioCache";

// Mock logger
vi.mock("app/shared/services/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("app/shared/services/logger.config", () => ({
  LOG_CATEGORIES: {
    CACHE: "cache",
  },
}));

describe("audioCache", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("should have localStorage available", () => {
    localStorage.setItem("test", "value");
    expect(localStorage.getItem("test")).toBe("value");
  });

  describe("cacheAudio and getCachedAudio", () => {
    it("should cache and retrieve audio buffer", () => {
      const testData = new Uint8Array([1, 2, 3, 4, 5]);
      const buffer = testData.buffer;
      const identifier = "test-audio";

      cacheAudio(identifier, buffer);
      const retrieved = getCachedAudio(identifier);

      expect(retrieved).not.toBeNull();
      expect(new Uint8Array(retrieved!)).toEqual(testData);
    });

    it("should return null for non-existent cache", () => {
      const retrieved = getCachedAudio("non-existent");
      expect(retrieved).toBeNull();
    });

    it("should handle empty buffer", () => {
      const buffer = new ArrayBuffer(0);
      cacheAudio("empty", buffer);
      const retrieved = getCachedAudio("empty");
      // Note: Due to if (!base64) check, empty buffers return null
      // This is existing behavior being tested
      expect(retrieved).toBeNull();
    });
  });

  describe("cacheBlob and getCachedBlob", () => {
    it("should cache and retrieve blob", async () => {
      const testData = new Uint8Array([10, 20, 30]);
      const blob = new Blob([testData], { type: "audio/mpeg" });
      const identifier = "test-blob";

      await cacheBlob(identifier, blob);
      const retrieved = getCachedBlob(identifier);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.type).toBe("audio/mpeg");
      const arrayBuffer = await retrieved!.arrayBuffer();
      expect(new Uint8Array(arrayBuffer)).toEqual(testData);
    });

    it("should return null for non-existent blob", () => {
      const retrieved = getCachedBlob("non-existent");
      expect(retrieved).toBeNull();
    });

    it("should use custom mime type", async () => {
      const testData = new Uint8Array([1, 2, 3]);
      const blob = new Blob([testData], { type: "audio/wav" });
      await cacheBlob("custom-type", blob);
      const retrieved = getCachedBlob("custom-type", "audio/wav");
      expect(retrieved).not.toBeNull();
      expect(retrieved!.type).toBe("audio/wav");
    });
  });

  describe("clearAudioCache", () => {
    it("should clear all cached audio", () => {
      cacheAudio("audio1", new ArrayBuffer(10));
      cacheAudio("audio2", new ArrayBuffer(20));
      localStorage.setItem("other-key", "value");

      clearAudioCache();

      expect(getCachedAudio("audio1")).toBeNull();
      expect(getCachedAudio("audio2")).toBeNull();
      expect(localStorage.getItem("other-key")).toBe("value");
    });
  });
});
