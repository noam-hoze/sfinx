/**
 * Runtime logging assertions for API routes with correlation context.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type LogMock = {
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  debug: ReturnType<typeof vi.fn>;
};

const createLogMock = (): LogMock => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
});

const createRequest = (body: unknown, headers?: Record<string, string>) =>
  new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      ...headers,
    },
  });

beforeEach(() => {
  vi.resetModules();
});

describe("API logging runtime assertions", () => {
  it("logs errors with requestId in chat route", async () => {
    const log = createLogMock();
    vi.doMock("app/shared/services", () => ({ log }));
    vi.doMock("openai", () => ({
      default: class OpenAI {
        chat = { completions: { create: vi.fn().mockRejectedValue(new Error("boom")) } };
      },
    }));

    const { POST } = await import("app/api/interviews/chat/route");
    const request = createRequest({ persona: "persona", instruction: "hi" }, { "x-request-id": "req-1" });
    await POST(request);

    expect(log.error).toHaveBeenCalled();
    const payload = log.error.mock.calls[0]?.[2] ?? log.error.mock.calls[0]?.[1];
    expect(payload).toMatchObject({ requestId: "req-1" });
  });

  it("logs errors with requestId in evaluate-output route", async () => {
    const log = createLogMock();
    vi.doMock("app/shared/services", () => ({ log }));
    vi.doMock("openai", () => ({
      default: class OpenAI {
        chat = { completions: { create: vi.fn().mockRejectedValue(new Error("boom")) } };
      },
    }));

    const { POST } = await import("app/api/interviews/evaluate-output/route");
    const request = createRequest({
      actualOutput: "1",
      expectedOutput: "1",
      codingTask: "task",
      codeSnapshot: "code",
    }, { "x-request-id": "req-2" });
    await POST(request);

    expect(log.error).toHaveBeenCalled();
    const payload = log.error.mock.calls[0]?.[2] ?? log.error.mock.calls[0]?.[1];
    expect(payload).toMatchObject({ requestId: "req-2" });
  });

  it("logs errors with requestId in evaluate-answer-fast route", async () => {
    const log = createLogMock();
    vi.doMock("app/shared/services", () => ({ log }));
    vi.doMock("lib/prisma", () => ({
      default: {
        interviewSession: { findUnique: vi.fn().mockRejectedValue(new Error("boom")) },
      },
    }));

    const { POST } = await import("app/api/interviews/evaluate-answer-fast/route");
    const request = createRequest({
      sessionId: "session-1",
      question: "q",
      answer: "a",
      experienceCategories: [{ name: "Cat" }],
      currentCounts: [{ categoryName: "Cat", count: 0, avgStrength: 0, dontKnowCount: 0 }],
      excludedTopics: [],
    }, { "x-request-id": "req-3" });
    await POST(request as Request);

    expect(log.error).toHaveBeenCalled();
    const payload = log.error.mock.calls[0]?.[2] ?? log.error.mock.calls[0]?.[1];
    expect(payload).toMatchObject({ requestId: "req-3" });
  });

  it("logs errors with requestId in evaluate-answer route", async () => {
    const log = createLogMock();
    vi.doMock("app/shared/services", () => ({ log }));
    vi.doMock("lib/prisma", () => ({
      default: {
        interviewSession: { findUnique: vi.fn().mockRejectedValue(new Error("boom")) },
      },
    }));

    const { POST } = await import("app/api/interviews/evaluate-answer/route");
    const request = createRequest({
      sessionId: "session-2",
      question: "q",
      answer: "a",
      timestamp: new Date().toISOString(),
      experienceCategories: [{ name: "Cat", description: "desc" }],
      currentCounts: [{ categoryName: "Cat", count: 0, avgStrength: 0 }],
    }, { "x-request-id": "req-4" });
    await POST(request as Request);

    expect(log.error).toHaveBeenCalled();
    const payload = log.error.mock.calls[0]?.[2] ?? log.error.mock.calls[0]?.[1];
    expect(payload).toMatchObject({ requestId: "req-4" });
  });

  it("logs errors with requestId in generate-profile-story route", async () => {
    const log = createLogMock();
    vi.doMock("app/shared/services", () => ({ log }));
    vi.doMock("lib/prisma", () => ({
      default: {
        interviewSession: { findUnique: vi.fn().mockRejectedValue(new Error("boom")) },
      },
    }));

    const { POST } = await import("app/api/interviews/generate-profile-story/route");
    const request = createRequest({ sessionId: "session-3" }, { "x-request-id": "req-5" });
    await POST(request as Request);

    expect(log.error).toHaveBeenCalled();
    const payload = log.error.mock.calls[0]?.[2] ?? log.error.mock.calls[0]?.[1];
    expect(payload).toMatchObject({ requestId: "req-5" });
  });

  it("logs errors with requestId in iterations POST route", async () => {
    const log = createLogMock();
    vi.doMock("app/shared/services", () => ({ log }));
    vi.doMock("app/shared/services/prisma", () => ({
      prisma: {
        iteration: { create: vi.fn().mockRejectedValue(new Error("boom")) },
      },
    }));

    const { POST } = await import("app/api/interviews/session/[sessionId]/iterations/route");
    const request = createRequest({
      timestamp: new Date().toISOString(),
      codeSnapshot: "code",
      actualOutput: "1",
      expectedOutput: "1",
      evaluation: "correct",
      reasoning: "ok",
      matchPercentage: 100,
      caption: "cap",
    }, { "x-request-id": "req-6" });
    await POST(request as Request, { params: Promise.resolve({ sessionId: "session-4" }) });

    expect(log.error).toHaveBeenCalled();
    const payload = log.error.mock.calls[0]?.[2] ?? log.error.mock.calls[0]?.[1];
    expect(payload).toMatchObject({ requestId: "req-6" });
  });

  it("logs errors with requestId in iterations GET route", async () => {
    const log = createLogMock();
    vi.doMock("app/shared/services", () => ({ log }));
    vi.doMock("app/shared/services/prisma", () => ({
      prisma: {
        iteration: { findMany: vi.fn().mockRejectedValue(new Error("boom")) },
      },
    }));

    const { GET } = await import("app/api/interviews/session/[sessionId]/iterations/route");
    const request = new Request("http://localhost", { headers: { "x-request-id": "req-7" } });
    await GET(request as Request, { params: Promise.resolve({ sessionId: "session-5" }) });

    expect(log.error).toHaveBeenCalled();
    const payload = log.error.mock.calls[0]?.[2] ?? log.error.mock.calls[0]?.[1];
    expect(payload).toMatchObject({ requestId: "req-7" });
  });

  it("logs errors with requestId in transcribe route", async () => {
    const log = createLogMock();
    vi.doMock("app/shared/services", () => ({ log }));

    const { POST } = await import("app/api/transcribe/route");
    const request = {
      headers: new Headers({ "x-request-id": "req-8" }),
      formData: async () => {
        throw new Error("boom");
      },
    } as unknown as Request;

    await POST(request);

    expect(log.error).toHaveBeenCalled();
    const payload = log.error.mock.calls[0]?.[2] ?? log.error.mock.calls[0]?.[1];
    expect(payload).toMatchObject({ requestId: "req-8" });
  });

  it("logs errors with requestId in tts route", async () => {
    const log = createLogMock();
    vi.doMock("app/shared/services", () => ({ log }));

    const { POST } = await import("app/api/tts/route");
    const request = new Request("http://localhost", {
      method: "POST",
      body: "{",
      headers: { "x-request-id": "req-9" },
    });
    await POST(request);

    expect(log.error).toHaveBeenCalled();
    const payload = log.error.mock.calls[0]?.[2] ?? log.error.mock.calls[0]?.[1];
    expect(payload).toMatchObject({ requestId: "req-9" });
  });

  it("logs errors with requestId in candidate basic route", async () => {
    const log = createLogMock();
    vi.doMock("app/shared/services", () => ({ log }));
    vi.doMock("app/shared/services/auth", () => ({ authOptions: {} }));
    vi.doMock("next-auth/next", () => ({ getServerSession: vi.fn().mockResolvedValue({ user: { id: "user" } }) }));
    vi.doMock("@prisma/client", () => ({
      PrismaClient: class PrismaClient {
        user = { findUnique: vi.fn().mockRejectedValue(new Error("boom")) };
      },
    }));

    const { GET } = await import("app/api/candidates/[id]/basic/route");
    const request = new Request("http://localhost?skip-auth=true", { headers: { "x-request-id": "req-10" } });
    await GET(request as Request, { params: Promise.resolve({ id: "candidate-1" }) });

    expect(log.error).toHaveBeenCalled();
    const payload = log.error.mock.calls[0]?.[2] ?? log.error.mock.calls[0]?.[1];
    expect(payload).toMatchObject({ requestId: "req-10" });
  });

  it("logs errors with requestId in applicants route", async () => {
    const log = createLogMock();
    vi.doMock("app/shared/services", () => ({ log }));
    vi.doMock("next-auth", () => ({
      getServerSession: vi.fn().mockResolvedValue({ user: { id: "user", role: "ADMIN" } }),
    }));
    vi.doMock("lib/prisma", () => ({
      default: {
        job: { findUnique: vi.fn().mockRejectedValue(new Error("boom")) },
      },
    }));
    vi.doMock("app/shared/services/server", () => ({
      authOptions: {},
      getCached: vi.fn().mockResolvedValue(null),
      setCached: vi.fn().mockResolvedValue(undefined),
    }));

    const { GET } = await import("app/api/company/jobs/[jobId]/applicants/route");
    const request = new Request("http://localhost", { headers: { "x-request-id": "req-11" } });
    await GET(request as Request, { params: Promise.resolve({ jobId: "job-1" }) });

    expect(log.error).toHaveBeenCalled();
    const payload = log.error.mock.calls[0]?.[2] ?? log.error.mock.calls[0]?.[1];
    expect(payload).toMatchObject({ requestId: "req-11" });
  });
});
