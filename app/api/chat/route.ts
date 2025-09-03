import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
// Eleven Labs import removed - not needed in chat route

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
    try {
        const { messages, systemPrompt } = await request.json();

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json(
                { error: "Messages array is required" },
                { status: 400 }
            );
        }

        const completion = await openai.chat.completions.create({
            model: "gpt-4", // 🧠 MODEL: GPT-4 (most capable)
            messages: [
                {
                    role: "system",
                    content: systemPrompt || getDefaultSystemPrompt(),
                },
                ...messages,
            ],
            max_tokens: 1500, // 📏 RESPONSE LENGTH: Increased for better guidance
            temperature: 0.6, // 🎯 CREATIVITY: Slightly more focused
        });

        const response = completion.choices[0]?.message?.content;

        if (!response) {
            return NextResponse.json(
                { error: "No response generated" },
                { status: 500 }
            );
        }

        return NextResponse.json({ response });
    } catch (error) {
        console.error("OpenAI API error:", error);
        return NextResponse.json(
            { error: "Failed to generate response" },
            { status: 500 }
        );
    }
}

function getDefaultSystemPrompt(): string {
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
6. Always be supportive and professional

Current interview tasks:
- Task 1: Build a UserList React component that fetches users from an API and displays them
- Task 2: Debug a counter component with a state management bug

Respond conversationally and professionally, like a real interviewer would.`;
}
