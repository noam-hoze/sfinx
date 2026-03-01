import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { log } from "app/shared/services";

import { LOG_CATEGORIES } from "app/shared/services/logger.config";
const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEWS;

const openaiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
    try {
        const MAX_PASTE_TOPICS = process.env.NEXT_PUBLIC_MAX_PASTE_TOPICS;

        if (!MAX_PASTE_TOPICS) {
            throw new Error("NEXT_PUBLIC_MAX_PASTE_TOPICS is required");
        }

        const topicsCount = parseInt(MAX_PASTE_TOPICS, 10);

        if (isNaN(topicsCount) || topicsCount <= 0) {
            throw new Error("NEXT_PUBLIC_MAX_PASTE_TOPICS must be a positive integer");
        }

        const body = await request.json();
        const { pastedContent, codingTask } = body;

        if (!pastedContent || !codingTask) {
            return NextResponse.json(
                { error: "Missing required fields: pastedContent, codingTask" },
                { status: 400 }
            );
        }

        log.info(LOG_CATEGORY, "[Topic Identification] Analyzing pasted code for topics...");

        const systemPrompt = `You are analyzing code a candidate pasted during an interview.

**Pasted Code:**
\`\`\`
${pastedContent}
\`\`\`

**Coding Task Context:**
${codingTask}

**Your Task:**
1. Identify the ${topicsCount} MOST IMPORTANT concepts/topics this code demonstrates that the candidate should understand
2. Generate an initial question to begin evaluating their understanding

**IMPORTANT:** Limit to ${topicsCount} topics maximum. Focus on the most critical concepts only.

Return ONLY valid JSON in this exact format:
{
  "topics": [
    {"name": "useEffect lifecycle understanding", "description": "How useEffect manages side effects and dependencies"},
    {"name": "Error handling patterns", "description": "Catching and displaying errors from async operations"},
    {"name": "State management with useState", "description": "Managing component state"}
  ],
  "initialQuestion": "Can you explain how the useEffect hook is being used here?"
}

Keep topic names concise (< 50 characters) and descriptions brief (< 100 characters).
Maximum 3-4 topics to ensure comprehensive evaluation without overwhelming the candidate.`;

        const completion = await openaiClient.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemPrompt },
                {
                    role: "user",
                    content: "Analyze the code and return the topics and initial question.",
                },
            ],
            temperature: 0.3,
            response_format: { type: "json_object" },
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) {
            throw new Error("Empty response from OpenAI");
        }

        const result = JSON.parse(content);

        // Validate response structure
        if (
            !result.topics ||
            !Array.isArray(result.topics) ||
            result.topics.length === 0 ||
            !result.initialQuestion
        ) {
            throw new Error("Invalid response structure from OpenAI");
        }

        // Validate each topic has name and description
        for (const topic of result.topics) {
            if (!topic.name || !topic.description) {
                throw new Error("Invalid topic structure: missing name or description");
            }
        }

        log.info(LOG_CATEGORY, "[Topic Identification] Identified topics:", result.topics.length);

        return NextResponse.json(result);
    } catch (error: any) {
        log.error(LOG_CATEGORY, "[Topic Identification] Error:", error);
        return NextResponse.json(
            {
                error: "Failed to identify paste topics",
                details: process.env.NODE_ENV !== "production" ? error.message : undefined,
            },
            { status: 500 }
        );
    }
}

