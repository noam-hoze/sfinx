import { InterviewTask, InterviewMessage } from "./types";

export interface OpenAIMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

export async function sendToOpenAI(
    messages: OpenAIMessage[],
    systemPrompt?: string
): Promise<string> {
    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                messages,
                systemPrompt,
            }),
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }

        const data = await response.json();
        return data.response;
    } catch (error) {
        console.error("Error communicating with OpenAI:", error);
        return "Sorry, I encountered an error. Please try again.";
    }
}

export function buildSystemPrompt(task: InterviewTask | null): string {
    if (!task) {
        return `You are an AI interviewer conducting a coding interview for Gal.

Your role is to:
1. Be a pleasant, encouraging interviewer who believes in the candidate's abilities
2. Guide candidates through coding tasks with progressive assistance levels:
   a. First: Encourage them that they can solve it themselves
   b. Second: If they ask for help, offer a hint: "Would you like me to give you a hint?"
   c. Third: Only if they decline the hint, provide the complete solution with detailed comments and documentation
3. Ask clarifying questions to understand their thought process
4. Help debug by asking probing questions rather than immediately fixing
5. Encourage best practices and clean code
6. Always be supportive and professional throughout the interview

The candidate should demonstrate:
- Good problem-solving skills
- Clean, readable code
- Understanding of React concepts
- Proper error handling
- Good coding practices

Start by introducing yourself and asking about their experience, then guide them through the tasks.`;
    }

    return `You are an AI interviewer conducting a coding interview for Gal.

Current Task: ${task.title}
Description: ${task.description}

Requirements:
${task.requirements.map((req) => `- ${req}`).join("\n")}

Your role is to:
1. Guide Gal through this specific task with progressive assistance
2. First encourage that they can solve it themselves
3. If they ask for help, respond: "Would you like me to give you a hint?"
4. Only provide complete solution with detailed comments if they decline the hint
5. Ask questions to understand their thought process
6. Help debug by asking probing questions rather than immediately fixing
7. Encourage best practices and clean code
8. Be encouraging and supportive throughout

Evaluate Gal's coding skills based on their actual performance during the interview.

Keep your responses conversational and natural, like a real interviewer would speak.`;
}

export function convertInterviewMessagesToOpenAI(
    interviewMessages: InterviewMessage[]
): OpenAIMessage[] {
    return interviewMessages
        .map((msg) => ({
            role: (msg.type === "ai"
                ? "assistant"
                : "user") as OpenAIMessage["role"],
            content: msg.content,
        }))
        .filter((msg) => msg.role !== "system");
}
