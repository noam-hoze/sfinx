import OpenAI from "openai";
import { log as logger } from "../../../app/shared/services";

export type ControlResult = {
  pillars: { adaptability: number; creativity: number; reasoning: number };
  rationale: string;
  pillarRationales: { adaptability: string; creativity: string; reasoning: string };
};

const client = new OpenAI({ apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY });

export async function requestControlDeltaOnly(opts: {
  company: string;
  role: string;
  lastQ: string;
  lastA: string;
  readOnlyHistory?: string; // optional text block
  timeoutMs?: number;
}): Promise<ControlResult> {
  const { company, role, lastQ, lastA, readOnlyHistory = "", timeoutMs = 5000 } = opts;
  const system = `You are the evaluation module for a technical interview at ${company} for the ${role} position.\nStage: Background.\n\nCRITICAL RULES:\n- Score ONLY the last user answer that follows.\n- Use the read-only history for understanding terms only; DO NOT award credit for past turns.\n- If the last user answer contains no concrete, attributable evidence for a pillar, output 0 for that pillar.\n- Every non-zero pillar MUST be justified with a short rationale referencing exact phrases from the last answer.\n- DO NOT initiate or suggest moving to coding; that decision is external and controlled by the system.\n\n${readOnlyHistory}\n\nOutput: STRICT JSON only (no preface) with fields: pillars {adaptability, creativity, reasoning} (0-100), rationale (string), pillarRationales {adaptability: string, creativity: string, reasoning: string}.`;
  try {
    logger.info("[tests][CONTROL] prompt", { lastQ, lastA, system });
  } catch {}

  const run = client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      { role: "system", content: system },
      { role: "assistant", content: lastQ },
      { role: "user", content: lastA },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "control_schema",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            pillars: {
              type: "object",
              additionalProperties: false,
              properties: {
                adaptability: { type: "number" },
                creativity: { type: "number" },
                reasoning: { type: "number" },
              },
              required: ["adaptability", "creativity", "reasoning"],
            },
            rationale: { type: "string" },
            pillarRationales: {
              type: "object",
              additionalProperties: false,
              properties: {
                adaptability: { type: "string" },
                creativity: { type: "string" },
                reasoning: { type: "string" },
              },
              required: ["adaptability", "creativity", "reasoning"],
            },
          },
          required: ["pillars", "rationale", "pillarRationales"],
        },
        strict: true,
      } as any,
    },
  });

  const res = await Promise.race([
    run,
    new Promise((_, rej) => setTimeout(() => rej(new Error("CONTROL timeout")), timeoutMs)),
  ]);

  const text = (res as any).choices?.[0]?.message?.content ?? "";
  try {
    logger.info("[tests][CONTROL] raw", { text });
  } catch {}
  return JSON.parse(text) as ControlResult;
}


