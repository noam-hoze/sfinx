"use client";

import { useState } from "react";
import OpenAI from "openai";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface ControlData {
  type: string;
  pasteEvaluationId: string;
  confidence: number;
  turnCount: number;
  readyToEvaluate: boolean;
}

interface FinalEvaluation {
  understanding: "full" | "partial" | "none";
  accountabilityScore: number;
  reasoning: string;
  caption: string;
}

export default function ExternalToolConversationTest() {
  const [pastedCode, setPastedCode] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationStarted, setConversationStarted] = useState(false);
  
  // Debug state
  const [controlData, setControlData] = useState<ControlData | null>(null);
  const [finalEvaluation, setFinalEvaluation] = useState<FinalEvaluation | null>(null);
  const [lastPrompt, setLastPrompt] = useState<string>("");
  
  const pasteEvaluationId = "test-paste-001";

  const buildPasteEvaluationPrompt = (turnCount: number) => {
    const conversationHistory = messages
      .map(m => `${m.role === "user" ? "Candidate" : "AI"}: ${m.content}`)
      .join("\n");

    return `You are a technical interviewer evaluating whether a candidate understands code they pasted from an external source.

**Current Context:**
- Candidate pasted: ${pastedCode}
- Conversation so far: ${conversationHistory || "No conversation yet"}
- Current turn: ${turnCount}/3

**Your Task:**
1. Determine if candidate understands the pasted code (confidence 0-100)
2. If confidence < 70% and turnCount < 3, ask ONE follow-up question (1-2 sentences)
3. If confidence >= 70% OR turnCount >= 3, set readyToEvaluate=true
4. Vary your phrasing naturally - don't repeat exact same questions

**Response Format:**
First line: CONTROL: {CONTROL_JSON_HERE}
Second line onward: Your spoken/text response to the candidate

**CONTROL JSON Structure:**
{
  "type": "PASTE_EVAL_CONTROL",
  "pasteEvaluationId": "${pasteEvaluationId}",
  "confidence": 0-100,
  "turnCount": ${turnCount},
  "readyToEvaluate": boolean
}

**Rules:**
- Set readyToEvaluate=true when confidence >= 70% OR turnCount >= 3
- Keep questions short and conversational
- If user avoids question, rephrase naturally
- Don't teach or give hints
- On turn 3, accept whatever answer you have`;
  };

  const handleSimulatePaste = async () => {
    if (!pastedCode.trim()) {
      alert("Please paste some code first");
      return;
    }

    setConversationStarted(true);
    setIsLoading(true);
    setMessages([]);
    setControlData(null);
    setFinalEvaluation(null);

    try {
      const openaiClient = new OpenAI({
        apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
        dangerouslyAllowBrowser: true,
      });

      // Simple prompt for FIRST question only (no evaluation yet)
      const initialPrompt = `You are a technical interviewer. A candidate just pasted this code:

${pastedCode}

Ask ONE short, relevant question (1-2 sentences) to understand if they comprehend what they pasted. Don't evaluate yet, just ask.`;

      setLastPrompt(initialPrompt);

      const completion = await openaiClient.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: initialPrompt },
          { role: "user", content: "I just pasted this code." },
        ],
        temperature: 0.7,
      });

      const aiText = completion.choices[0]?.message?.content || "";

      const aiMessage: Message = {
        role: "assistant",
        content: aiText,
        timestamp: Date.now(),
      };

      setMessages([aiMessage]);

      // Set initial CONTROL data (no confidence yet)
      setControlData({
        type: "PASTE_EVAL_CONTROL",
        pasteEvaluationId: pasteEvaluationId,
        confidence: 0,
        turnCount: 1,
        readyToEvaluate: false,
      });
    } catch (error) {
      console.error("Error:", error);
      alert("Error communicating with OpenAI");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!userInput.trim() || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: userInput.trim(),
      timestamp: Date.now(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setUserInput("");
    setIsLoading(true);

    try {
      const openaiClient = new OpenAI({
        apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
        dangerouslyAllowBrowser: true,
      });

      const turnCount = Math.floor(newMessages.filter(m => m.role === "assistant").length) + 1;
      const systemPrompt = buildPasteEvaluationPrompt(turnCount);
      
      setLastPrompt(systemPrompt);

      const conversationMessages = newMessages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      const completion = await openaiClient.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          ...conversationMessages,
        ],
        temperature: 0.7,
      });

      const response = completion.choices[0]?.message?.content || "";
      
      let aiText = response;
      let control: ControlData | null = null;

      // Parse CONTROL message if present
      const controlMatch = response.match(/CONTROL:\s*(\{[^}]+\})/);
      if (controlMatch) {
        try {
          control = JSON.parse(controlMatch[1]);
          setControlData(control);
          // Remove CONTROL line from displayed text
          aiText = response.replace(/CONTROL:\s*\{[^}]+\}\s*\n?/, "").trim();
        } catch (e) {
          console.error("Failed to parse CONTROL:", e);
        }
      }

      const aiMessage: Message = {
        role: "assistant",
        content: aiText,
        timestamp: Date.now(),
      };

      const finalMessages = [...newMessages, aiMessage];
      setMessages(finalMessages);

      // Check if ready to evaluate
      if (control?.readyToEvaluate) {
        await triggerFinalEvaluation(finalMessages);
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Error communicating with OpenAI");
    } finally {
      setIsLoading(false);
    }
  };

  const triggerFinalEvaluation = async (conversationMessages: Message[]) => {
    try {
      const userAnswers = conversationMessages
        .filter(m => m.role === "user")
        .map(m => m.content)
        .join(" ");

      const aiQuestions = conversationMessages
        .filter(m => m.role === "assistant")
        .map(m => m.content)
        .join(" ");

      const response = await fetch("/api/interviews/evaluate-paste-accountability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pastedContent: pastedCode,
          aiQuestion: aiQuestions,
          userAnswer: userAnswers,
          codingTask: "Building a React component",
        }),
      });

      if (response.ok) {
        const evaluation = await response.json();
        setFinalEvaluation(evaluation);
      } else {
        console.error("Evaluation failed:", await response.text());
      }
    } catch (error) {
      console.error("Error triggering evaluation:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">External Tool Usage - Conversation Test</h1>

        <div className="grid grid-cols-3 gap-6">
          {/* Left: Paste Input */}
          <div className="col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">1. Paste Code</h2>
              <textarea
                value={pastedCode}
                onChange={(e) => setPastedCode(e.target.value)}
                placeholder="Paste your code here..."
                className="w-full h-40 p-4 border border-gray-300 rounded-lg font-mono text-sm"
                disabled={conversationStarted}
              />
              <button
                onClick={handleSimulatePaste}
                disabled={!pastedCode.trim() || conversationStarted || isLoading}
                className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {conversationStarted ? "Conversation Started" : "Simulate Paste"}
              </button>
            </div>

            {/* Chat */}
            {conversationStarted && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">2. Chat with AI</h2>
                <div className="space-y-4 mb-4 h-96 overflow-y-auto border border-gray-200 rounded-lg p-4">
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg ${
                        msg.role === "user"
                          ? "bg-blue-100 ml-12"
                          : "bg-gray-100 mr-12"
                      }`}
                    >
                      <div className="text-xs text-gray-500 mb-1">
                        {msg.role === "user" ? "You" : "AI"}
                      </div>
                      <div className="text-sm">{msg.content}</div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="text-center text-gray-500">
                      <div className="inline-block animate-pulse">AI is thinking...</div>
                    </div>
                  )}
                </div>

                {!finalEvaluation && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                      placeholder="Type your answer..."
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                      disabled={isLoading}
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!userInput.trim() || isLoading}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                    >
                      Send
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Debug Panel */}
          <div className="space-y-6">
            {/* System Prompt */}
            {lastPrompt && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">System Prompt (Last Sent)</h2>
                <div className="bg-gray-50 p-4 rounded-lg max-h-64 overflow-y-auto">
                  <pre className="text-xs whitespace-pre-wrap font-mono">
                    {lastPrompt}
                  </pre>
                </div>
              </div>
            )}

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Debug Panel</h2>

              {controlData ? (
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Confidence</div>
                    <div className="text-3xl font-bold text-blue-600">
                      {controlData.confidence}/100
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${controlData.confidence}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-600 mb-1">Turn Count</div>
                    <div className="text-2xl font-bold">
                      {controlData.turnCount}/3
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-600 mb-1">Ready to Evaluate</div>
                    <div className={`text-xl font-bold ${
                      controlData.readyToEvaluate ? "text-green-600" : "text-orange-600"
                    }`}>
                      {controlData.readyToEvaluate ? "✓ YES" : "○ NO"}
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="text-xs text-gray-500 mb-2">Raw CONTROL Data:</div>
                    <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto">
                      {JSON.stringify(controlData, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="text-gray-400 text-center py-8">
                  No conversation data yet
                </div>
              )}
            </div>

            {/* Final Evaluation */}
            {finalEvaluation && (
              <div className="bg-green-50 border-2 border-green-500 rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4 text-green-800">
                  ✓ Final Evaluation
                </h2>
                <div className="space-y-3">
                  <div>
                    <div className="text-sm text-gray-600">Understanding</div>
                    <div className="text-lg font-bold capitalize">
                      {finalEvaluation.understanding}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-600">Accountability Score</div>
                    <div className="text-3xl font-bold text-green-600">
                      {finalEvaluation.accountabilityScore}/100
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-600">Reasoning</div>
                    <div className="text-sm bg-white p-3 rounded">
                      {finalEvaluation.reasoning}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-600">Caption</div>
                    <div className="text-sm font-medium">
                      {finalEvaluation.caption}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setConversationStarted(false);
                    setPastedCode("");
                    setMessages([]);
                    setControlData(null);
                    setFinalEvaluation(null);
                  }}
                  className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Start New Test
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Conversation History */}
        {messages.length > 0 && (
          <div className="mt-6 bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Full Conversation History</h2>
            <div className="space-y-2 text-sm font-mono">
              {messages.map((msg, idx) => (
                <div key={idx} className="border-b pb-2">
                  <span className="font-bold">
                    {msg.role === "user" ? "USER" : "AI"}:
                  </span>{" "}
                  {msg.content}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

