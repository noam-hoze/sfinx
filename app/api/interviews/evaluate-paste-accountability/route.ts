import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { log } from "app/shared/services";

const openaiClient = new OpenAI({
    apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { pastedContent, aiQuestion, userAnswer, codingTask } = body;

        if (!pastedContent || !aiQuestion || !userAnswer) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        log.info("[Paste Accountability] Evaluating understanding...");

        const systemPrompt = `You are evaluating whether a candidate understands code they pasted from an external source during a coding interview.

**Context:**
- Coding Task: ${codingTask || "Build a React component"}
- Code Pasted: ${pastedContent}
- AI's Question: ${aiQuestion}
- Candidate's Answer: ${userAnswer}

**Your Task:**
Evaluate if the candidate truly understands the pasted code and can take ownership of it.

**Evaluation Criteria:**
1. **Full Understanding**: Candidate clearly explains the code, understands all key concepts, can modify it independently
2. **Partial Understanding**: Candidate grasps some parts but struggles with details or key concepts
3. **No Understanding**: Candidate cannot explain the code, gives vague/incorrect answers, or avoids the question

**Accountability Score (0-100):**
- 80-100: Can fully own and modify the code independently
- 50-79: Understands main idea but would need help with modifications
- 20-49: Surface-level understanding, cannot explain key parts
- 0-19: No meaningful understanding, just copied code

Return ONLY valid JSON with this exact structure:
{
  "understanding": "full" | "partial" | "none",
  "accountabilityScore": number (0-100),
  "reasoning": "Brief explanation of their understanding level",
  "caption": "Short description for video evidence (e.g., 'Pasted React hook with full understanding')"
}`;

        const completion = await openaiClient.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemPrompt },
                {
                    role: "user",
                    content: `Evaluate the candidate's understanding of the pasted code based on their answer.`,
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
            !result.understanding ||
            typeof result.accountabilityScore !== "number" ||
            !result.reasoning ||
            !result.caption
        ) {
            throw new Error("Invalid response structure from OpenAI");
        }

        log.info("[Paste Accountability] Evaluation complete:", result);

        return NextResponse.json(result);
    } catch (error: any) {
        log.error("[Paste Accountability] Error:", error);
        return NextResponse.json(
            {
                error: "Failed to evaluate paste accountability",
                details: process.env.NODE_ENV !== "production" ? error.message : undefined,
            },
            { status: 500 }
        );
    }
}

