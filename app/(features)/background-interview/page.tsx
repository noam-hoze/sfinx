"use client";

import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter, useSearchParams } from "next/navigation";
import { store, RootState } from "@/shared/state/store";
import { interviewChatStore } from "@/shared/state/interviewChatStore";
import {
  start,
  aiFinal,
  userFinal,
  setExpectedBackgroundQuestion,
  setCompanyContext,
  setSessionId as setMachineSessionId,
} from "@/shared/state/slices/interviewMachineSlice";
import QuestionCard from "./components/QuestionCard";
import CompletionScreen from "./components/CompletionScreen";
import BackgroundDebugPanel from "app/shared/components/BackgroundDebugPanel";
import OpenAI from "openai";
import { buildOpenAIBackgroundPrompt } from "@/shared/prompts/openAIInterviewerPrompt";
import {
  askViaChatCompletion,
  runBackgroundControl,
  generateAssistantReply,
} from "../interview/components/chat/openAITextConversationHelpers";
import { stopCheck } from "@/shared/services/weightedMean/scorer";
import { createInterviewSession } from "../interview/components/services/interviewSessionService";
import { buildControlContextMessages, CONTROL_CONTEXT_TURNS } from "../../shared/services";

export default function BackgroundInterviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useDispatch();
  const machineState = useSelector(
    (state: RootState) => state.interviewMachine.state
  );
  const companyName = useSelector(
    (state: RootState) => state.interviewMachine.companyName
  );

  const [initialized, setInitialized] = useState(false);
  const [autoStarted, setAutoStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [codingTimeChallenge, setCodingTimeChallenge] = useState<number>(30);
  const [backgroundTimeSeconds, setBackgroundTimeSeconds] = useState<number | undefined>(undefined);
  const [openaiClient, setOpenaiClient] = useState<OpenAI | null>(null);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const sessionId = useSelector((state: RootState) => state.interviewMachine.sessionId);

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

  // Cleanup mic stream on unmount
  useEffect(() => {
    return () => {
      if (micStream) {
        micStream.getTracks().forEach((track) => track.stop());
        console.log("[bg-interview] Mic stream stopped on cleanup");
      }
    };
  }, [micStream]);

  // Auto-start interview when component mounts with required params
  useEffect(() => {
    if (autoStarted || !openaiClient) return;

    const startInterview = async () => {
      try {
        // Request microphone permissions upfront
        console.log("[bg-interview] Requesting microphone permissions...");
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        setMicStream(stream);
        console.log("[bg-interview] Microphone access granted");
      
      // Get required params from URL (must come from demo page)
      const jobId = searchParams.get("jobId");
      const companyId = searchParams.get("companyId");
      const userId = searchParams.get("userId");
      const existingAppId = searchParams.get("applicationId");
      
      if (!userId || !jobId || !companyId || !existingAppId) {
        throw new Error("Missing required parameters. Please start from the demo page.");
      }
      
      // Update URL with params
      const urlParams = new URLSearchParams({
        demo: "true",
        jobId,
        userId,
        companyId,
      });
      if (existingAppId) {
        urlParams.set("applicationId", existingAppId);
      }
      router.replace(`/background-interview?${urlParams.toString()}`);
      
      console.log("[bg-interview] Using existing application:", existingAppId);
      setApplicationId(existingAppId);
      
      // Create session only (application already exists from demo page)
      const session = await createInterviewSession({
        applicationId: existingAppId,
        companyId,
        userId,
        isDemoMode: true,
      });
      
      if (session?.interviewSession?.id) {
        const sessId = session.interviewSession.id;
        dispatch(setMachineSessionId({ sessionId: sessId }));
        console.log("[bg-interview] Session created:", sessId);
      }
      
      // Extract company and role from jobId (e.g., "meta-frontend-engineer" -> "meta", "frontend-engineer")
      const parts = jobId.split("-");
      const companySlug = parts[0];
      const roleSlug = parts.slice(1).join("-");

      // Fetch interview script
      const scriptResp = await fetch(
        `/api/interviews/script?company=${companySlug}&role=${roleSlug}`
      );
      if (!scriptResp.ok) {
        throw new Error("Failed to load interview script");
      }
      const scriptData = await scriptResp.json();

      // Extract company name from script or capitalize slug
      const companyNameFromScript = scriptData.companyName || 
        companySlug.charAt(0).toUpperCase() + companySlug.slice(1);

      // Set company context
      dispatch(
        setCompanyContext({
          companyName: companyNameFromScript,
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

      // Set background time and configure guard
      if (scriptData.backgroundQuestionTimeSeconds) {
        setBackgroundTimeSeconds(scriptData.backgroundQuestionTimeSeconds);
        const timeboxMs = scriptData.backgroundQuestionTimeSeconds * 1000;
        interviewChatStore.dispatch({ 
          type: "BG_GUARD_SET_TIMEBOX", 
          payload: { timeboxMs } 
        } as any);
        console.log("[bg-interview] Background timebox set:", timeboxMs, "ms");
      }

      // Initialize state machine - start with candidate name
      const firstName = name.trim().split(' ')[0];
      dispatch(start({ candidateName: firstName }));

      // Initialize chat store stage
      interviewChatStore.dispatch({ type: "SET_STAGE", payload: "background" } as any);

      // Start background timer
      interviewChatStore.dispatch({ type: "BG_GUARD_START_TIMER" } as any);

      // Generate and post first background question
      const persona = buildOpenAIBackgroundPrompt(companyNameFromScript);
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
      setAutoStarted(true);
    } catch (error) {
      console.error("Failed to initialize interview:", error);
    }
    };

    startInterview();
  }, [openaiClient, autoStarted, searchParams, router, dispatch]);

  const handleSubmitAnswer = async (answer: string) => {
    if (!openaiClient || !companyName) {
      console.log("[bg-interview] Submit blocked - missing openaiClient or companyName", {
        hasClient: !!openaiClient,
        companyName,
      });
      return;
    }

    console.log("[bg-interview] Submit answer:", answer);
    setSubmitting(true);

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
          const historyMessages = buildControlContextMessages(CONTROL_CONTEXT_TURNS);
          const followUp = await askViaChatCompletion(openaiClient, persona, historyMessages);
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
      setSubmitting(false);
      console.log("[bg-interview] Submitting state cleared");
    }
  };

  // Show loading screen while initializing
  if (!initialized) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <svg
            className="w-12 h-12 text-blue-600 animate-spin"
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
          <p className="text-gray-600 text-lg">Initializing interview...</p>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex relative">
        {/* Debug Toggle Button */}
        <button
          onClick={() => setShowDebugPanel(!showDebugPanel)}
          className="absolute top-4 right-4 z-50 p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
          title={showDebugPanel ? "Hide Debug Panel" : "Show Debug Panel"}
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </button>

        {/* Main content area */}
        <div className={`flex-1 flex items-center justify-center p-4 transition-all ${showDebugPanel ? '' : 'pr-0'}`}>
          <CompletionScreen
            codingTimeChallenge={codingTimeChallenge}
            onStartCoding={() => {}}
            jobId={searchParams.get("jobId") || "meta-frontend-engineer"}
            userId={searchParams.get("userId") || ""}
            companyId={searchParams.get("companyId") || "meta"}
            applicationId={applicationId || ""}
            sessionId={sessionId || ""}
          />
        </div>

        {/* Debug panel - fixed on right side */}
        {showDebugPanel && (
          <div className="w-96 p-6 overflow-y-auto">
            <BackgroundDebugPanel 
              timeboxMs={backgroundTimeSeconds ? backgroundTimeSeconds * 1000 : undefined}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex relative">
      {/* Debug Toggle Button */}
      <button
        onClick={() => setShowDebugPanel(!showDebugPanel)}
        className="absolute top-4 right-4 z-50 p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
        title={showDebugPanel ? "Hide Debug Panel" : "Show Debug Panel"}
      >
        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </button>

      {/* Main content area */}
      <div className={`flex-1 flex items-center justify-center p-4 transition-all ${showDebugPanel ? '' : 'pr-0'}`}>
            <QuestionCard
              question={currentQuestion}
              onSubmitAnswer={handleSubmitAnswer}
              loading={submitting}
              micStream={micStream}
            />
      </div>

      {/* Debug panel - fixed on right side */}
      {showDebugPanel && (
        <div className="w-96 p-6 overflow-y-auto">
          <BackgroundDebugPanel 
            timeboxMs={backgroundTimeSeconds ? backgroundTimeSeconds * 1000 : undefined}
          />
        </div>
      )}
    </div>
  );
}

