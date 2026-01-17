/** Unit tests for interview chat helpers. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  askViaChatCompletion,
  buildClosingInstruction,
  generateAssistantReply,
} from "../openAITextConversationHelpers";

/** Builds a fetch response stub with a configurable JSON payload. */
const buildResponse = (options: { ok: boolean; json: unknown }) => ({
  ok: options.ok,
  json: vi.fn().mockResolvedValue(options.json),
});

/** Builds a fetch response stub whose JSON handler rejects. */
const buildRejectingResponse = () => ({
  ok: false,
  json: vi.fn().mockRejectedValue(new Error("bad json")),
});

describe("openAITextConversationHelpers", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("posts chat completion payloads and returns response text", async () => {
    fetchMock.mockResolvedValue(
      buildResponse({ ok: true, json: { response: "ok" } })
    );

    const reply = await askViaChatCompletion(null, "persona", [
      { role: "user", content: "hi" },
    ]);

    expect(reply).toBe("ok");
    expect(fetchMock).toHaveBeenCalledWith("/api/interviews/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        persona: "persona",
        conversationHistory: [{ role: "user", content: "hi" }],
      }),
    });
  });

  it("posts assistant prompt payloads and returns response text", async () => {
    fetchMock.mockResolvedValue(
      buildResponse({ ok: true, json: { response: "reply" } })
    );

    const reply = await generateAssistantReply(null, "persona", "instruction");

    expect(reply).toBe("reply");
    expect(fetchMock).toHaveBeenCalledWith("/api/interviews/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        persona: "persona",
        instruction: "instruction",
      }),
    });
  });

  it("throws the API error when chat completion fails", async () => {
    fetchMock.mockResolvedValue(
      buildResponse({ ok: false, json: { error: "bad request" } })
    );

    await expect(
      askViaChatCompletion(null, "persona", [])
    ).rejects.toThrow("bad request");
  });

  it("falls back to a generic error when JSON parsing fails", async () => {
    fetchMock.mockResolvedValue(buildRejectingResponse());

    await expect(
      generateAssistantReply(null, "persona", "instruction")
    ).rejects.toThrow("Unknown error");
  });

  it("builds a closing instruction with trimmed candidate names", () => {
    expect(buildClosingInstruction(" Ada ")).toBe(
      'Say exactly: "Thank you so much Ada, the next steps will be shared with you shortly."'
    );
  });

  it("builds a closing instruction with a fallback greeting for blank names", () => {
    expect(buildClosingInstruction("   ")).toBe(
      'Say exactly: "Thank you so much there, the next steps will be shared with you shortly."'
    );
  });
});
