/**
 * Builds OpenAI prompt for generating AI-written background interview summaries.
 * Takes conversation transcript and dynamic experience categories, returns structured assessment for hiring managers.
 */

export interface ConversationMessage {
    speaker: string;
    text: string;
    timestamp: number;
}

export interface ExperienceCategory {
    name: string;
    description: string;
    weight: number;
}

export interface CategoryScores {
    [categoryName: string]: number;
}

export interface CategoryRationales {
    [categoryName: string]: string;
}

export interface SummaryInput {
    messages: ConversationMessage[];
    experienceCategories: ExperienceCategory[];
    scores?: CategoryScores;
    rationales?: CategoryRationales;
    companyName: string;
    roleName: string;
    finalScore?: number; // Overall final score (0-100) if available
}

export interface CategoryOutput {
    score: number;
    assessment: string;
    oneLiner: string;
    evidence: Array<{
        question: string;
        answerExcerpt: string;
        reasoning: string;
    }>;
}

export interface SummaryOutput {
    executiveSummary: string;
    executiveSummaryOneLiner: string;
    recommendation: string;
    experienceCategories: {
        [categoryName: string]: CategoryOutput;
    };
}

export function buildBackgroundSummaryPrompt(input: SummaryInput): string {
    const { messages, experienceCategories, scores, rationales, companyName, roleName, finalScore } = input;

    // Format conversation transcript
    const transcript = messages
        .map((m) => `${m.speaker === "ai" ? "Interviewer" : "Candidate"}: ${m.text}`)
        .join("\n\n");

    // Count interviewer questions
    const interviewerQuestions = messages.filter(m => m.speaker === "ai");
    const questionCount = interviewerQuestions.length;

    const scoresProvided = !!scores;

    // Build category list
    const categoryList = experienceCategories
        .map(cat => `  * ${cat.name}: ${cat.description}`)
        .join('\n');

    // Build scores section if provided
    const scoresSection = scoresProvided
        ? `- AI Evaluation Scores:\n${experienceCategories.map(cat => `  * ${cat.name}: ${scores?.[cat.name] ?? 'N/A'}/100`).join('\n')}`
        : `- You must estimate scores (0-100) for these categories based on the conversation evidence.`;

    // Build rationales section if provided
    const rationalesSection = rationales
        ? `- AI Evaluation Notes:\n${experienceCategories.map(cat => `  * ${cat.name}: ${rationales[cat.name] || "N/A"}`).join('\n')}`
        : '';

    // Use final score if provided, otherwise calculate average from experience categories
    const averageScore = finalScore !== undefined && finalScore !== null
        ? finalScore
        : (scores && experienceCategories.length > 0
            ? Math.round(
                experienceCategories.reduce((sum, cat) => sum + (scores[cat.name] || 0), 0) /
                experienceCategories.length
              )
            : null);

    const scoreContext = averageScore !== null
        ? `\n- **Average Category Score: ${averageScore}/100** - This is the candidate's overall experience score. You MUST use this exact number when referencing the average score in your recommendation.`
        : '';

    // Build recommendation guidelines
    const recommendationGuidelines = `
RECOMMENDATION GUIDELINES:
When making your hiring recommendation, use the **Average Category Score** provided above as your primary reference:

- **Strong Hire** (typically 80+ average): Exceptional performance across most/all categories. Clear evidence of mastery and experience.
- **Hire** (typically 60-79 average): Solid performance with clear strengths. Some areas may need development but overall qualified for the role.
- **Maybe** (typically 40-59 average): Mixed performance. Shows potential but significant gaps or concerns exist. Could be right fit with more assessment.
- **No Hire** (typically <40 average): Weak performance across categories. Limited relevant experience or inability to demonstrate competence.

CRITICAL: Your recommendation MUST align with the numerical evidence. When referencing the average score in your recommendation, use the EXACT "Average Category Score" number provided in the context above - do not calculate your own average. If the average is below 40, you should strongly lean toward "No Hire" or "Maybe" at best. A "Hire" or "Strong Hire" recommendation with low scores requires extraordinary justification (e.g., one critical category is very strong, or interview conditions were poor).

If you believe there's a mismatch between scores and your recommendation, explicitly acknowledge this in your rationale and explain why (e.g., "Despite average score of 35 across categories, recommend Maybe because candidate showed strong problem-solving approach even with limited depth of experience").`;

    // Build JSON structure for each category
    const categoryJsonStructure = experienceCategories
        .map(cat => `  "${cat.name}": {
    "score": ${scoresProvided && scores?.[cat.name] !== undefined ? scores[cat.name] : 0},
    "assessment": "2-3 paragraph detailed assessment of the candidate's ${cat.name.toLowerCase()}. Explain what the score means in practical terms for the role.",
    "oneLiner": "Single sentence (15-25 words) capturing the key finding about ${cat.name.toLowerCase()}.",
    "evidence": [
      {
        "question": "The exact first question the interviewer asked",
        "answerExcerpt": "Key excerpt from candidate's answer (1-2 sentences)",
        "reasoning": "How this demonstrates or fails to demonstrate ${cat.name.toLowerCase()}"
      },
      {
        "question": "The exact second question the interviewer asked",
        "answerExcerpt": "Key excerpt from candidate's answer (1-2 sentences)",
        "reasoning": "How this demonstrates or fails to demonstrate ${cat.name.toLowerCase()}"
      }
      // ... MUST include ALL ${questionCount} questions
    ]
  }`).join(',\n');

    const system = `You are an executive recruiter writing a candidate assessment report for hiring managers at ${companyName}.

Your task is to analyze this background interview conversation and create a comprehensive, professional assessment that helps the hiring manager make an informed decision about the candidate for the ${roleName} position.

CONTEXT:
- This was the background stage of a technical interview
- The AI interviewer assessed the following experience categories:
${categoryList}
${scoresSection}${scoreContext}
${rationalesSection}

${recommendationGuidelines}

CONVERSATION TRANSCRIPT:
${transcript}

OUTPUT REQUIREMENTS:
Return a JSON object with this exact structure.
IMPORTANT: 
- All "score" fields MUST be numbers (0-100). Do NOT use "undefined" or "null".
- CRITICAL: The transcript contains ${questionCount} interviewer questions. EACH category's evidence array MUST contain EXACTLY ${questionCount} evidence objects - one for every single question asked.
- Every evidence object MUST have all three fields: "question", "answerExcerpt", and "reasoning". NO empty strings or null values.

{
  "executiveSummary": "2-3 paragraph overview of the candidate's overall performance, key strengths, and any concerns. Written for busy executives.",
  "executiveSummaryOneLiner": "Single sentence (15-25 words) capturing the most critical insight from the executive summary.",
  "recommendation": "Clear recommendation: 'Strong Hire', 'Hire', 'Maybe', or 'No Hire' based on the scoring guidelines above. Include 1-2 sentence rationale that explicitly references the Average Category Score provided in the context and explains how it justifies the recommendation.",
  "experienceCategories": {
${categoryJsonStructure}
  }
}

WRITING GUIDELINES:
1. Write in professional, clear prose suitable for senior hiring managers
2. Be specific - reference actual things the candidate said
3. Balance positive observations with constructive concerns
4. Focus on job-relevant insights, not personality
5. For each evidence item, explain how the answer demonstrates (or fails to demonstrate) that specific category
6. Include the most relevant part of the candidate's response in answerExcerpt (1-2 sentences)
7. Assessments should explain what the score means in practice (e.g., "score of 75 indicates...")
8. Use concrete examples from the conversation
9. Avoid jargon and buzzwords - be direct
10. Make the recommendation actionable
11. Ensure executive summary reflects the numerical reality - don't inflate language if scores are low
12. If scores are low (<40 average) but you see potential, focus on growth areas and what's missing rather than overstating current capabilities

Return ONLY the JSON object, no other text.`;

    return system;
}

export const SUMMARY_MODEL = "gpt-4o";
export const SUMMARY_TEMPERATURE = 0.3;

