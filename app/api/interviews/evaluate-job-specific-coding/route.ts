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
        const body = await request.json();
        const { finalCode, codingTask, categories, referenceCode, expectedOutput, sessionId } = body;

        if (!finalCode || !codingTask || !categories || !Array.isArray(categories)) {
            return NextResponse.json(
                { error: "Missing required fields: finalCode, codingTask, categories" },
                { status: 400 }
            );
        }

        log.info(LOG_CATEGORY, "[Job-Specific Coding Eval] Evaluating code against categories:", categories.length);
        log.info(LOG_CATEGORY, "[Job-Specific Coding Eval] Has reference code:", !!referenceCode);
        log.info(LOG_CATEGORY, "[Job-Specific Coding Eval] Has session ID:", !!sessionId);

        // Separate Problem Solving from other categories
        const problemSolvingCategory = categories.find((cat: any) => cat.name === "Problem Solving");
        const otherCategories = categories.filter((cat: any) => cat.name !== "Problem Solving");

        // Build category list for prompt (excluding Problem Solving if we have reference code)
        const evaluationCategories = referenceCode ? otherCategories : categories;
        const categoryList = evaluationCategories
            .map((cat: any) => `- ${cat.name}: ${cat.description}`)
            .join("\n");

        const systemPrompt = `You are a technical interviewer evaluating code against specific job requirements.

**Coding Task:**
${codingTask}

**Final Code Submitted:**
\`\`\`
${finalCode}
\`\`\`
${referenceCode ? `
**Reference Solution:**
\`\`\`
${referenceCode}
\`\`\`
` : ''}
**Evaluation Criteria:**
${categoryList}

**Your Task:**
Evaluate the submitted code against each criterion above. For each criterion, provide:
1. A score from 0-100
2. A brief text explanation (2-3 sentences)

**Scoring Guidelines:**
- 90-100: Exceptional implementation, demonstrates mastery
- 75-89: Strong implementation, follows best practices
- 60-74: Adequate implementation, some improvements needed
- 40-59: Basic implementation, significant gaps in best practices
- 20-39: Poor implementation, lacks fundamental understanding
- 0-19: Missing or incorrect implementation

Return ONLY valid JSON with this exact structure:
{
  "categories": {
    "Category Name 1": {
      "score": number (0-100),
      "text": "Brief explanation of assessment"
    },
    "Category Name 2": {
      "score": number (0-100),
      "text": "Brief explanation of assessment"
    }
  }
}`;

        const completion = await openaiClient.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemPrompt },
                {
                    role: "user",
                    content: "Evaluate the code against the specified criteria.",
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
        if (!result.categories || typeof result.categories !== "object") {
            throw new Error("Invalid response structure from OpenAI");
        }

        // Handle Problem Solving specially if we have reference code
        if (problemSolvingCategory && referenceCode && sessionId) {
            log.info(LOG_CATEGORY, "[Job-Specific Coding Eval] Evaluating Problem Solving separately");

            try {
                // Step 1: Get output match from best iteration
                const iterations = await prisma.iteration.findMany({
                    where: { interviewSessionId: sessionId },
                    orderBy: { matchPercentage: 'desc' },
                    take: 1
                });

                const bestIteration = iterations[0];
                const outputMatchPercentage = bestIteration?.matchPercentage || 0;

                log.info(LOG_CATEGORY, `[Job-Specific Coding Eval] Best iteration output match: ${outputMatchPercentage}%`);

                // Step 2: Ask OpenAI for code similarity
                const codeSimilarityPrompt = `Compare this candidate's code to the reference solution.

**Coding Task:**
${codingTask}

**Reference Solution:**
\`\`\`
${referenceCode}
\`\`\`

**Candidate's Final Code:**
\`\`\`
${finalCode}
\`\`\`

Evaluate code similarity (0-100) based on:
- Algorithm/approach used
- Code structure
- Problem-solving strategy
- Edge case handling

Return ONLY JSON:
{
  "codeSimilarityScore": number (0-100),
  "text": "Brief explanation"
}`;

                const similarityCompletion = await openaiClient.chat.completions.create({
                    model: "gpt-4o",
                    messages: [
                        { role: "system", content: "You are an expert code reviewer. Respond in JSON format." },
                        { role: "user", content: codeSimilarityPrompt }
                    ],
                    temperature: 0.3,
                    response_format: { type: "json_object" },
                });

                const similarityContent = similarityCompletion.choices[0]?.message?.content;
                if (!similarityContent) {
                    throw new Error("Empty similarity response");
                }

                const similarityResult = JSON.parse(similarityContent);
                const codeSimilarityScore = similarityResult.codeSimilarityScore || 0;

                // Step 3: Calculate average ourselves
                const problemSolvingScore = Math.round((codeSimilarityScore + outputMatchPercentage) / 2);

                log.info(LOG_CATEGORY, `[Job-Specific Coding Eval] Problem Solving - Code: ${codeSimilarityScore}, Output: ${outputMatchPercentage}, Final: ${problemSolvingScore}`);
                // Add Problem Solving to result
                result.categories["Problem Solving"] = {
                    score: problemSolvingScore,
                    text: `${similarityResult.text || 'Evaluated based on code similarity and output correctness.'} (Code similarity: ${codeSimilarityScore}%, Output match: ${outputMatchPercentage}%)`
                };
            } catch (psError: any) {
                log.error(LOG_CATEGORY, "[Job-Specific Coding Eval] Problem Solving evaluation error:", psError);
                // Fallback: just use code evaluation
                result.categories["Problem Solving"] = {
                    score: 50,
                    text: "Unable to fully evaluate Problem Solving (missing iteration data)"
                };
            }
        }

        log.info(LOG_CATEGORY, "[Job-Specific Coding Eval] Evaluation complete");

        return NextResponse.json(result);
    } catch (error: any) {
        log.error(LOG_CATEGORY, "[Job-Specific Coding Eval] Error:", error);
        return NextResponse.json(
            {
                error: "Failed to evaluate job-specific coding",
                details: process.env.NODE_ENV !== "production" ? error.message : undefined,
            },
            { status: 500 }
        );
    }
}

