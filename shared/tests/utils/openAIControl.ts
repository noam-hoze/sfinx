import OpenAI from "openai";
import { log as logger } from "../../../app/shared/services";

export type ControlResult = {
  categories: Record<string, number>;
  rationale: string;
  categoryRationales: Record<string, string>;
};

const client = new OpenAI({ apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY });

export async function requestControlDeltaOnly(opts: {
  company: string;
  role: string;
  lastQ: string;
  lastA: string;
  experienceCategories: Array<{name: string; description: string; weight?: number}>;
  readOnlyHistory?: string;
  timeoutMs?: number;
}): Promise<ControlResult> {
  const { company, role, lastQ, lastA, experienceCategories, readOnlyHistory = "", timeoutMs = 5000 } = opts;
  
  const categoryList = experienceCategories
    .map(cat => `- ${cat.name}: ${cat.description}`)
    .join("\n");
  
  const system = `You are the evaluation module for a technical interview at ${company} for the ${role} position.\nStage: Background.\n\nCRITICAL RULES:\n- Score ONLY the last user answer that follows.\n- Use the read-only history for understanding terms only; DO NOT award credit for past turns.\n- If the last user answer contains no concrete, attributable evidence for a category, output 0 for that category.\n- Every non-zero category MUST be justified with a short rationale referencing exact phrases from the last answer.\n- DO NOT initiate or suggest moving to coding; that decision is external and controlled by the system.\n\nCategories to evaluate:\n${categoryList}\n\n${readOnlyHistory}\n\nOutput: STRICT JSON only (no preface) with fields: categories (object with category names as keys, scores 0-100 as values), rationale (string), categoryRationales (object with category names as keys, rationale strings as values).`;
  
  try {
    logger.info("[tests][CONTROL] prompt", { lastQ, lastA, system });
  } catch {}

  const categoryProperties: Record<string, any> = {};
  const categoryRationaleProperties: Record<string, any> = {};
  const requiredCategories: string[] = [];
  
  experienceCategories.forEach(cat => {
    categoryProperties[cat.name] = { type: "number" };
    categoryRationaleProperties[cat.name] = { type: "string" };
    requiredCategories.push(cat.name);
  });

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
            categories: {
              type: "object",
              additionalProperties: false,
              properties: categoryProperties,
              required: requiredCategories,
            },
            rationale: { type: "string" },
            categoryRationales: {
              type: "object",
              additionalProperties: false,
              properties: categoryRationaleProperties,
              required: requiredCategories,
            },
          },
          required: ["categories", "rationale", "categoryRationales"],
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

