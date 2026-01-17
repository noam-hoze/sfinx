/**
 * Unit tests for openAIInterviewerPrompt
 */

import { describe, it, expect } from "vitest";
import { buildOpenAIBackgroundPrompt } from "./openAIInterviewerPrompt";

describe("openAIInterviewerPrompt", () => {
  describe("buildOpenAIBackgroundPrompt", () => {
    it("should include company name in prompt", () => {
      const prompt = buildOpenAIBackgroundPrompt("Acme Corp");
      expect(prompt).toContain("Acme Corp");
    });

    it("should include categories when provided", () => {
      const categories = [
        { name: "Backend Systems", description: "API design" },
        { name: "Frontend", description: "React experience" },
      ];
      const prompt = buildOpenAIBackgroundPrompt("Acme", categories);
      expect(prompt).toContain("Backend Systems");
      expect(prompt).toContain("Frontend");
    });

    it("should use default text when no categories provided", () => {
      const prompt = buildOpenAIBackgroundPrompt("Acme");
      expect(prompt).toContain("relevant experience areas");
    });

    it("should include behavioral rules", () => {
      const prompt = buildOpenAIBackgroundPrompt("Acme");
      expect(prompt).toContain("Behavioral Rules");
      expect(prompt).toContain("Ask one question per turn");
    });

    it("should include curiosity tools", () => {
      const prompt = buildOpenAIBackgroundPrompt("Acme");
      expect(prompt).toContain("Curiosity Tools");
      expect(prompt).toContain("What trade-offs did you consider?");
    });

    it("should handle empty categories array", () => {
      const prompt = buildOpenAIBackgroundPrompt("Acme", []);
      expect(prompt).toContain("relevant experience areas");
    });
  });
});
