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

/**
 * Require a non-empty string.
 */
function requireNonEmptyString(value: unknown, label: string): string {
    if (typeof value !== "string" || value.trim().length === 0) {
        throw new Error(`${label} is required.`);
    }
    return value;
}

/**
 * Require a numeric score for a category.
 */
function requireCategoryScore(scores: CategoryScores | undefined, categoryName: string): number {
    const value = scores?.[categoryName];
    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(`Score is required for ${categoryName}.`);
    }
    return value;
}

/**
 * Require a rationale for a category.
 */
function requireCategoryRationale(rationales: CategoryRationales | undefined, categoryName: string): string {
    return requireNonEmptyString(rationales?.[categoryName], `Rationale for ${categoryName}`);
}

export function buildBackgroundSummaryPrompt(input: SummaryInput): string {
    const { messages, experienceCategories, scores, rationales, companyName, roleName } = input;
    const resolvedCompanyName = requireNonEmptyString(companyName, "companyName");
    const resolvedRoleName = requireNonEmptyString(roleName, "roleName");

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
        ? `- AI Evaluation Scores:\n${experienceCategories
            .map(cat => `  * ${cat.name}: ${requireCategoryScore(scores, cat.name)}/100`)
            .join('\n')}`
        : `- You must estimate scores (0-100) for these categories based on the conversation evidence.`;

    // Build rationales section if provided
    const rationalesSection = rationales
        ? `- AI Evaluation Notes:\n${experienceCategories
            .map(cat => `  * ${cat.name}: ${requireCategoryRationale(rationales, cat.name)}`)
            .join('\n')}`
        : '';

    // Build JSON structure for each category
    const categoryJsonStructure = experienceCategories
        .map(cat => `  "${cat.name}": {
    "score": ${scoresProvided ? requireCategoryScore(scores, cat.name) : 0},
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

    const system = `You are an executive recruiter writing a candidate assessment report for hiring managers at ${resolvedCompanyName}.

Your task is to analyze this background interview conversation and create a comprehensive, professional assessment that helps the hiring manager make an informed decision about the candidate for the ${resolvedRoleName} position.

CONTEXT:
- This was the background stage of a technical interview
- The AI interviewer assessed the following experience categories:
${categoryList}
${scoresSection}
${rationalesSection}

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
  "recommendation": "Clear recommendation: 'Strong Hire', 'Hire', 'Maybe', or 'No Hire' with 1 sentence rationale",
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

Return ONLY the JSON object, no other text.`;

    return system;
}

export const SUMMARY_MODEL = "gpt-4o";
export const SUMMARY_TEMPERATURE = 0.3;
