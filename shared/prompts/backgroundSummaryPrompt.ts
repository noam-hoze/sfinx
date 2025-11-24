/**
 * Builds OpenAI prompt for generating AI-written background interview summaries.
 * Takes conversation transcript and trait scores, returns structured assessment for hiring managers.
 */

export interface ConversationMessage {
    speaker: string;
    text: string;
    timestamp: number;
}

export interface TraitScores {
    adaptability: number;
    creativity: number;
    reasoning: number;
}

export interface TraitRationales {
    adaptability?: string;
    creativity?: string;
    reasoning?: string;
}

export interface SummaryInput {
    messages: ConversationMessage[];
    scores?: TraitScores;
    rationales?: TraitRationales;
    companyName: string;
    roleName: string;
}

export interface SummaryOutput {
    executiveSummary: string;
    executiveSummaryOneLiner: string;
    recommendation: string;
    adaptability: {
        score: number;
        assessment: string;
        oneLiner: string;
        evidence: Array<{
            question: string;
            answerExcerpt: string;
            reasoning: string;
        }>;
    };
    creativity: {
        score: number;
        assessment: string;
        oneLiner: string;
        evidence: Array<{
            question: string;
            answerExcerpt: string;
            reasoning: string;
        }>;
    };
    reasoning: {
        score: number;
        assessment: string;
        oneLiner: string;
        evidence: Array<{
            question: string;
            answerExcerpt: string;
            reasoning: string;
        }>;
    };
}

export function buildBackgroundSummaryPrompt(input: SummaryInput): string {
    const { messages, scores, rationales, companyName, roleName } = input;

    // Format conversation transcript
    const transcript = messages
        .map((m) => `${m.speaker === "ai" ? "Interviewer" : "Candidate"}: ${m.text}`)
        .join("\n\n");

    const scoresProvided = !!scores;

    const system = `You are an executive recruiter writing a candidate assessment report for hiring managers at ${companyName}.

Your task is to analyze this background interview conversation and create a comprehensive, professional assessment that helps the hiring manager make an informed decision about the candidate for the ${roleName} position.

CONTEXT:
- This was the background stage of a technical interview
- The AI interviewer assessed three key traits: Adaptability, Creativity, and Reasoning
${scoresProvided ? `- AI Evaluation Scores: Adaptability (${scores.adaptability}/100), Creativity (${scores.creativity}/100), Reasoning (${scores.reasoning}/100)` : "- You must estimate scores (0-100) for these traits based on the conversation evidence."}
${rationales ? `- AI Evaluation Notes:
  * Adaptability: ${rationales.adaptability || "N/A"}
  * Creativity: ${rationales.creativity || "N/A"}
  * Reasoning: ${rationales.reasoning || "N/A"}` : ""}

CONVERSATION TRANSCRIPT:
${transcript}

OUTPUT REQUIREMENTS:
Return a JSON object with this exact structure.
IMPORTANT: All "score" fields MUST be numbers (0-100). Do NOT use "undefined" or "null".

{
  "executiveSummary": "2-3 paragraph overview of the candidate's overall performance, key strengths, and any concerns. Written for busy executives.",
  "executiveSummaryOneLiner": "Single sentence (15-25 words) capturing the most critical insight from the executive summary.",
  "recommendation": "Clear recommendation: 'Strong Hire', 'Hire', 'Maybe', or 'No Hire' with 1 sentence rationale",
  "adaptability": {
    "score": ${scoresProvided ? scores.adaptability : 0},
    "assessment": "2-3 paragraph detailed assessment of the candidate's adaptability. Explain what the score means in practical terms for the role.",
    "oneLiner": "Single sentence (15-25 words) capturing the key finding about adaptability.",
    "evidence": [
      {
        "question": "The exact question the interviewer asked",
        "answerExcerpt": "Key excerpt from candidate's answer (1-2 sentences that best demonstrate this trait)",
        "reasoning": "Why this exchange demonstrates adaptability"
      }
    ]
  },
  "creativity": {
    "score": ${scoresProvided ? scores.creativity : 0},
    "assessment": "2-3 paragraph detailed assessment of the candidate's creativity.",
    "oneLiner": "Single sentence (15-25 words) capturing the key finding about creativity.",
    "evidence": [similar structure]
  },
  "reasoning": {
    "score": ${scoresProvided ? scores.reasoning : 0},
    "assessment": "2-3 paragraph detailed assessment of the candidate's reasoning ability.",
    "oneLiner": "Single sentence (15-25 words) capturing the key finding about reasoning.",
    "evidence": [similar structure]
  }
}

WRITING GUIDELINES:
1. Write in professional, clear prose suitable for senior hiring managers
2. Be specific - reference actual things the candidate said
3. Balance positive observations with constructive concerns
4. Focus on job-relevant insights, not personality
5. Each evidence array should have 1-3 of the MOST compelling exchanges (quality over quantity)
6. Assessments should explain what the score means in practice (e.g., "score of 75 indicates...")
7. Use concrete examples from the conversation
8. Avoid jargon and buzzwords - be direct
9. Make the recommendation actionable

Return ONLY the JSON object, no other text.`;

    return system;
}

export const SUMMARY_MODEL = "gpt-4o";
export const SUMMARY_TEMPERATURE = 0.3;

