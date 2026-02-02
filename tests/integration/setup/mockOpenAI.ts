/**
 * Mock OpenAI responses for deterministic integration testing.
 *
 * This module provides:
 * 1. Predefined response scenarios for different candidate types
 * 2. Configurable response sequences for multi-turn interviews
 * 3. Helpers to set up specific test scenarios
 */

import { vi } from 'vitest';

// ============================================================================
// TYPES
// ============================================================================

export type UnderstandingLevel = 'FULL' | 'PARTIAL' | 'NONE';

export interface MockEvaluationResponse {
    isDontKnow: boolean;
    scores: Array<{ category: string; strength: number }>;
    question: string;
    evaluationIntent: string;
}

export interface MockPasteEvaluationResponse {
    understanding: UnderstandingLevel;
    accountabilityScore: number;
    reasoning: string;
    caption: string;
    nextQuestion?: string;
}

export interface MockCodingEvaluationResponse {
    evaluation: 'CORRECT' | 'PARTIAL' | 'INCORRECT';
    matchPercentage: number;
    reasoning: string;
    caption: string;
    categoryContributions?: Array<{
        categoryName: string;
        contributionStrength: number;
        explanation: string;
        caption: string;
    }>;
}

export interface MockBackgroundSummaryResponse {
    executiveSummary: string;
    executiveSummaryOneLiner: string;
    recommendation: string;
    experienceCategories: Record<string, {
        score: number;
        rawAverage: number;
        confidence: number;
        evidenceLinks: Array<{ timestamp: number; caption: string }>;
    }>;
}

// ============================================================================
// RESPONSE FACTORIES
// ============================================================================

/**
 * Create a standard evaluation response for background interview
 */
export function createEvaluationResponse(
    options: Partial<MockEvaluationResponse> & { categories?: string[] }
): MockEvaluationResponse {
    const categories = options.categories || ['Problem Solving', 'System Design', 'Communication'];

    return {
        isDontKnow: options.isDontKnow ?? false,
        scores: options.scores ?? categories.map(cat => ({
            category: cat,
            strength: 75, // Default to good score
        })),
        question: options.question ?? 'Can you tell me more about your experience?',
        evaluationIntent: options.evaluationIntent ?? 'Evaluating depth of technical experience.',
    };
}

/**
 * Create a "don't know" response
 */
export function createDontKnowResponse(
    categoryToExclude: string,
    allCategories: string[]
): MockEvaluationResponse {
    return {
        isDontKnow: true,
        scores: allCategories.map(cat => ({
            category: cat,
            strength: cat === categoryToExclude ? 0 : 50,
        })),
        question: "No problem. Let's move on to something else. Can you describe your experience with...?",
        evaluationIntent: 'Understanding the candidate\'s comfort with different technical areas.',
    };
}

/**
 * Create a clarification request response
 */
export function createClarificationResponse(
    categories: string[]
): MockEvaluationResponse {
    return {
        isDontKnow: false,
        scores: categories.map(cat => ({
            category: cat,
            strength: 0, // No score for clarification requests
        })),
        question: 'Let me rephrase that. When I asked about the system design, I meant...',
        evaluationIntent: 'Rephrasing to help candidate understand the question.',
    };
}

/**
 * Create paste accountability evaluation response
 */
export function createPasteEvaluationResponse(
    level: UnderstandingLevel,
    options?: Partial<MockPasteEvaluationResponse>
): MockPasteEvaluationResponse {
    const scoreMap: Record<UnderstandingLevel, number> = {
        FULL: 100,
        PARTIAL: 50,
        NONE: 0,
    };

    return {
        understanding: level,
        accountabilityScore: options?.accountabilityScore ?? scoreMap[level],
        reasoning: options?.reasoning ?? `Candidate demonstrated ${level.toLowerCase()} understanding of the pasted code.`,
        caption: options?.caption ?? `AI Assist: ${level} understanding shown`,
        nextQuestion: options?.nextQuestion,
    };
}

/**
 * Create coding iteration evaluation response
 */
export function createCodingEvaluationResponse(
    result: 'CORRECT' | 'PARTIAL' | 'INCORRECT',
    options?: Partial<MockCodingEvaluationResponse>
): MockCodingEvaluationResponse {
    const percentageMap = {
        CORRECT: 100,
        PARTIAL: 60,
        INCORRECT: 10,
    };

    return {
        evaluation: result,
        matchPercentage: options?.matchPercentage ?? percentageMap[result],
        reasoning: options?.reasoning ?? `Code evaluation: ${result}`,
        caption: options?.caption ?? `Iteration: ${result}`,
        categoryContributions: options?.categoryContributions,
    };
}

// ============================================================================
// RESPONSE SEQUENCES (for multi-turn interviews)
// ============================================================================

export type ResponseSequence = MockEvaluationResponse[];

/**
 * Strong candidate: consistent good answers across all categories
 */
export function createStrongCandidateSequence(
    categories: string[],
    numQuestions: number = 15
): ResponseSequence {
    const sequence: ResponseSequence = [];

    for (let i = 0; i < numQuestions; i++) {
        const targetCategory = categories[i % categories.length];
        sequence.push({
            isDontKnow: false,
            scores: categories.map(cat => ({
                category: cat,
                strength: cat === targetCategory ? 85 + Math.floor(Math.random() * 15) : 60 + Math.floor(Math.random() * 20),
            })),
            question: `Question ${i + 2} about ${categories[(i + 1) % categories.length]}...`,
            evaluationIntent: `Evaluating depth in ${targetCategory}.`,
        });
    }

    return sequence;
}

/**
 * Struggling candidate: multiple "don't know" responses, hits threshold
 */
export function createStrugglingCandidateSequence(
    categories: string[],
    dontKnowCategory: string,
    dontKnowThreshold: number = 2
): ResponseSequence {
    const sequence: ResponseSequence = [];
    let dontKnowCount = 0;

    // First few questions: normal answers
    for (let i = 0; i < 3; i++) {
        sequence.push(createEvaluationResponse({
            categories,
            scores: categories.map(cat => ({
                category: cat,
                strength: 45 + Math.floor(Math.random() * 20), // Lower scores
            })),
            question: `Question ${i + 2}...`,
        }));
    }

    // Hit the "don't know" category multiple times
    for (let i = 0; i < dontKnowThreshold; i++) {
        sequence.push(createDontKnowResponse(dontKnowCategory, categories));
        dontKnowCount++;
    }

    // After exclusion, continue with remaining categories
    const remainingCategories = categories.filter(c => c !== dontKnowCategory);
    for (let i = 0; i < 5; i++) {
        sequence.push(createEvaluationResponse({
            categories: remainingCategories,
            scores: remainingCategories.map(cat => ({
                category: cat,
                strength: 40 + Math.floor(Math.random() * 30),
            })),
            question: `Question ${sequence.length + 1}...`,
        }));
    }

    return sequence;
}

/**
 * Candidate who asks for clarification multiple times
 */
export function createClarificationSeekingSequence(
    categories: string[],
    clarificationThreshold: number = 3
): ResponseSequence {
    const sequence: ResponseSequence = [];

    // Normal question
    sequence.push(createEvaluationResponse({ categories }));

    // Clarification requests up to threshold
    for (let i = 0; i < clarificationThreshold; i++) {
        sequence.push(createClarificationResponse(categories));
    }

    // After threshold, move on with new question
    sequence.push(createEvaluationResponse({
        categories,
        question: "Let's move on to a different topic...",
    }));

    // Continue normally
    for (let i = 0; i < 5; i++) {
        sequence.push(createEvaluationResponse({ categories }));
    }

    return sequence;
}

// ============================================================================
// MOCK CONTROLLER
// ============================================================================

export class MockOpenAIController {
    private responseQueue: MockEvaluationResponse[] = [];
    private pasteResponseQueue: MockPasteEvaluationResponse[] = [];
    private codingResponseQueue: MockCodingEvaluationResponse[] = [];
    private callHistory: Array<{ type: string; input: unknown; response: unknown }> = [];

    constructor() {
        this.reset();
    }

    reset(): void {
        this.responseQueue = [];
        this.pasteResponseQueue = [];
        this.codingResponseQueue = [];
        this.callHistory = [];
    }

    // Queue management
    queueEvaluationResponses(responses: MockEvaluationResponse[]): void {
        this.responseQueue.push(...responses);
    }

    queuePasteResponses(responses: MockPasteEvaluationResponse[]): void {
        this.pasteResponseQueue.push(...responses);
    }

    queueCodingResponses(responses: MockCodingEvaluationResponse[]): void {
        this.codingResponseQueue.push(...responses);
    }

    // Get next response (FIFO)
    getNextEvaluationResponse(): MockEvaluationResponse {
        const response = this.responseQueue.shift();
        if (!response) {
            throw new Error('No more evaluation responses in queue. Did you forget to queue responses?');
        }
        return response;
    }

    getNextPasteResponse(): MockPasteEvaluationResponse {
        const response = this.pasteResponseQueue.shift();
        if (!response) {
            throw new Error('No more paste evaluation responses in queue.');
        }
        return response;
    }

    getNextCodingResponse(): MockCodingEvaluationResponse {
        const response = this.codingResponseQueue.shift();
        if (!response) {
            throw new Error('No more coding evaluation responses in queue.');
        }
        return response;
    }

    // Call tracking
    recordCall(type: string, input: unknown, response: unknown): void {
        this.callHistory.push({ type, input, response });
    }

    getCallHistory(): Array<{ type: string; input: unknown; response: unknown }> {
        return [...this.callHistory];
    }

    getCallCount(type?: string): number {
        if (type) {
            return this.callHistory.filter(c => c.type === type).length;
        }
        return this.callHistory.length;
    }
}

// Singleton instance for tests
export const mockOpenAI = new MockOpenAIController();

// ============================================================================
// VITEST MOCK SETUP
// ============================================================================

/**
 * Creates a mock for the OpenAI client that uses our controller.
 * Call this in your test setup.
 */
export function setupOpenAIMock(): void {
    vi.mock('openai', () => {
        return {
            default: class MockOpenAI {
                chat = {
                    completions: {
                        create: async (params: { messages: Array<{ role: string; content: string }> }) => {
                            const userMessage = params.messages.find(m => m.role === 'user')?.content || '';

                            // Determine response type based on prompt content
                            let response: unknown;
                            let responseType: string;

                            if (userMessage.includes('Score this answer') || userMessage.includes('evaluate-answer')) {
                                response = mockOpenAI.getNextEvaluationResponse();
                                responseType = 'evaluation';
                            } else if (userMessage.includes('pasted code') || userMessage.includes('accountability')) {
                                response = mockOpenAI.getNextPasteResponse();
                                responseType = 'paste';
                            } else if (userMessage.includes('code evaluation') || userMessage.includes('iteration')) {
                                response = mockOpenAI.getNextCodingResponse();
                                responseType = 'coding';
                            } else {
                                // Default to evaluation
                                response = mockOpenAI.getNextEvaluationResponse();
                                responseType = 'evaluation';
                            }

                            mockOpenAI.recordCall(responseType, params, response);

                            return {
                                choices: [{
                                    message: {
                                        content: JSON.stringify(response),
                                    },
                                }],
                            };
                        },
                    },
                };
            },
        };
    });
}
