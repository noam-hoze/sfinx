"use client";

import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { store, RootState } from "@/shared/state/store";
import { interviewChatStore } from "@/shared/state/interviewChatStore";
import {
  start,
  aiFinal,
  userFinal,
  setExpectedBackgroundQuestion,
  setCompanyContext,
  setSessionId,
} from "@/shared/state/slices/interviewMachineSlice";
import QuestionCard from "./components/QuestionCard";
import CompletionScreen from "./components/CompletionScreen";
import OpenAI from "openai";
import { buildOpenAIBackgroundPrompt } from "@/shared/prompts/openAIInterviewerPrompt";
import {
  askViaChatCompletion,
  runBackgroundControl,
  generateAssistantReply,
} from "../interview/components/chat/openAITextConversationHelpers";
import { stopCheck } from "@/shared/services/weightedMean/scorer";

export default function BackgroundInterviewPage() {
  const dispatch = useDispatch();
  const machineState = useSelector(
    (state: RootState) => state.interviewMachine.state
  );
  const companyName = useSelector(
    (state: RootState) => state.interviewMachine.companyName
  );

  const [name, setName] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [codingTimeChallenge, setCodingTimeChallenge] = useState<number>(30);
  const [openaiClient, setOpenaiClient] = useState<OpenAI | null>(null);

  // Initialize OpenAI client
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    if (!apiKey) {
      console.error("NEXT_PUBLIC_OPENAI_API_KEY is required");
      return;
    }
    setOpenaiClient(
      new OpenAI({
        apiKey,
        dangerouslyAllowBrowser: true,
      })
    );
  }, []);

  // Subscribe to chat store for messages
  useEffect(() => {
    const unsubscribe = interviewChatStore.subscribe(() => {
      const chatState = interviewChatStore.getState();
      const messages = chatState.messages;
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage.speaker === "ai") {
          setCurrentQuestion(lastMessage.text);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Monitor machine state for completion
  useEffect(() => {
    if (machineState === "in_coding_session") {
      setCompleted(true);
    }
  }, [machineState]);

  const handleStartInterview = async () => {
    if (!name.trim()) {
      return;
    }

    if (!openaiClient) {
      console.error("OpenAI client not initialized");
      return;
    }

    setLoading(true);
    try {
      // Use meta-frontend-engineer job (same as demo)
      const companySlug = "meta";
      const roleSlug = "frontend-engineer";

      // Fetch interview script
      const scriptResp = await fetch(
        `/api/interviews/script?company=${companySlug}&role=${roleSlug}`
      );
      if (!scriptResp.ok) {
        throw new Error("Failed to load interview script");
      }
      const scriptData = await scriptResp.json();

      // Set company context
      dispatch(
        setCompanyContext({
          companyName: "Meta",
          companySlug,
          roleSlug,
        })
      );

      // Set expected background question
      if (scriptData.backgroundQuestion) {
        dispatch(
          setExpectedBackgroundQuestion({
            question: String(scriptData.backgroundQuestion),
          })
        );
      }

      // Set coding time challenge (convert from seconds to minutes)
      if (scriptData.codingQuestionTimeSeconds) {
        setCodingTimeChallenge(Math.round(scriptData.codingQuestionTimeSeconds / 60));
      }

      // Initialize state machine - start with candidate name
      const firstName = name.trim().split(' ')[0];
      dispatch(start({ candidateName: firstName }));

      // Initialize chat store stage
      interviewChatStore.dispatch({ type: "SET_STAGE", payload: "background" } as any);

      // Start background timer
      interviewChatStore.dispatch({ type: "BG_GUARD_START_TIMER" } as any);

      // Generate and post first background question
      const persona = buildOpenAIBackgroundPrompt("Meta");
      const instruction = `Ask exactly: "${String(scriptData.backgroundQuestion)}"`;
      const firstQuestion = await generateAssistantReply(
        openaiClient,
        persona,
        instruction
      );

      if (firstQuestion) {
        // Add to chat store
        interviewChatStore.dispatch({
          type: "ADD_MESSAGE",
          payload: { text: firstQuestion, speaker: "ai" },
        } as any);

        setCurrentQuestion(firstQuestion);

        // Manually transition to background_asked_by_ai (skip greeting)
        // First go to greeting_said_by_ai
        dispatch(aiFinal({ text: "greeting" }));
        // Then simulate user response to move to greeting_responded_by_user
        dispatch(userFinal());
        // Then post the actual background question to move to background_asked_by_ai
        dispatch(aiFinal({ text: firstQuestion }));
        
        console.log("[bg-interview] Initialized in background mode, state:", store.getState().interviewMachine.state);
      }

      setInitialized(true);
    } catch (error) {
      console.error("Failed to initialize interview:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAnswer = async (answer: string) => {
    if (!openaiClient || !companyName) {
      console.log("[bg-interview] Submit blocked - missing openaiClient or companyName", {
        hasClient: !!openaiClient,
        companyName,
      });
      return;
    }

    console.log("[bg-interview] Submit answer:", answer);
    setLoading(true);

    try {
      // Add user message to chat store
      interviewChatStore.dispatch({
        type: "ADD_MESSAGE",
        payload: { text: answer, speaker: "user" },
      } as any);
      console.log("[bg-interview] User message added to store");

      // Transition machine
      dispatch(userFinal());
      const ms = store.getState().interviewMachine;
      console.log("[bg-interview] Machine state after userFinal:", ms.state);

      if (ms.state === "background_answered_by_user") {
        // Run control checks
        console.log("[bg-interview] Running control checks...");
        await runBackgroundControl(openaiClient);
        console.log("[bg-interview] Control checks complete");

        // Check if gate is satisfied
        const chatState = interviewChatStore.getState();
        const scorer = chatState.background?.scorer;
        const coverage = chatState.background?.coverage;
        const gateReady = !!(scorer && coverage && stopCheck(scorer, coverage));
        console.log("[bg-interview] Gate check:", {
          gateReady,
          scorer: scorer ? "present" : "missing",
          coverage,
        });

        if (gateReady) {
          // Gate satisfied - transition to coding
          console.log("[bg-interview] Gate satisfied - moving to completion");
          dispatch(aiFinal({ text: "" }));
          setCompleted(true);
        } else {
          // Ask follow-up question
          console.log("[bg-interview] Generating follow-up question...");
          const persona = buildOpenAIBackgroundPrompt(String(companyName));
          const followUp = await askViaChatCompletion(openaiClient, persona, [
            {
              role: "assistant",
              content: "Ask one short follow-up about their project.",
            },
            { role: "user", content: answer },
          ]);
          console.log("[bg-interview] Follow-up generated:", followUp);

          if (followUp) {
            // Add AI follow-up to chat store
            interviewChatStore.dispatch({
              type: "ADD_MESSAGE",
              payload: { text: followUp, speaker: "ai" },
            } as any);
            console.log("[bg-interview] Follow-up added to store");

            setCurrentQuestion(followUp);
            console.log("[bg-interview] Current question updated");

            // Transition machine
            dispatch(aiFinal({ text: followUp }));
            const newState = store.getState().interviewMachine.state;
            console.log("[bg-interview] Machine state after aiFinal:", newState);
          }
        }
      } else {
        console.warn("[bg-interview] Unexpected machine state:", ms.state);
      }
    } catch (error) {
      console.error("[bg-interview] Error processing answer:", error);
    } finally {
      setLoading(false);
      console.log("[bg-interview] Loading state cleared");
    }
  };

  const handleStartCoding = () => {
    // Placeholder for now
    console.log("Start coding challenge clicked");
  };

  if (!initialized) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-semibold text-gray-900 mb-3 tracking-tight">
              Background Interview
            </h1>
            <p className="text-lg text-gray-500">
              Tell us about yourself
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && name.trim() && !loading && openaiClient) {
                    handleStartInterview();
                  }
                }}
                placeholder="Your name"
                disabled={loading}
                className="w-full px-5 py-4 text-lg text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all placeholder:text-gray-400"
              />
            </div>

            <button
              onClick={handleStartInterview}
              disabled={loading || !openaiClient || !name.trim()}
              className="w-full bg-blue-600 text-white text-lg font-medium py-4 px-8 rounded-xl hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="w-5 h-5 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Starting...
                </span>
              ) : (
                "Continue"
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <CompletionScreen
        codingTimeChallenge={codingTimeChallenge}
        onStartCoding={handleStartCoding}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
      <QuestionCard
        question={currentQuestion}
        onSubmitAnswer={handleSubmitAnswer}
        loading={loading}
      />
    </div>
  );
}

