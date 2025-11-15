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
  setPreloadedData,
} from "@/shared/state/slices/interviewMachineSlice";
import QuestionCard from "./components/QuestionCard";
import CompletionScreen from "./components/CompletionScreen";
import BackgroundDebugPanel from "app/shared/components/BackgroundDebugPanel";
import AnnouncementScreen from "./components/AnnouncementScreen";
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

type Stage = 'loading' | 'welcome' | 'interview';

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
  const preloadedFirstQuestion = useSelector(
    (state: RootState) => state.interviewMachine.preloadedFirstQuestion
  );
  const userId = useSelector(
    (state: RootState) => state.interviewMachine.userId
  );
  const applicationId = useSelector(
    (state: RootState) => state.interviewMachine.applicationId
  );
  const sessionId = useSelector(
    (state: RootState) => state.interviewMachine.sessionId
  );
  const script = useSelector(
    (state: RootState) => state.interviewMachine.script
  );

  // UI stage management
  const [stage, setStage] = useState<Stage>('loading');
  const [name, setName] = useState("");
  
  // Interview flow state
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [announcementText, setAnnouncementText] = useState("");
  const [currentQuestion, setCurrentQuestion] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [codingTimeChallenge, setCodingTimeChallenge] = useState<number>(30);
  const [backgroundTimeSeconds, setBackgroundTimeSeconds] = useState<number | undefined>(undefined);
  const [openaiClient, setOpenaiClient] = useState<OpenAI | null>(null);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);

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

  // STAGE 1: Pre-loading on mount
  useEffect(() => {
    if (stage !== 'loading' || !openaiClient) return;

    const preloadData = async () => {
      try {
        console.log("[bg-interview] Stage 1: Starting pre-load...");
        
        // Get jobId and companyId from URL or use defaults
        const jobId = searchParams.get("jobId") || "meta-frontend-engineer";
        const companyId = searchParams.get("companyId") || "meta";
        
        // Extract company and role from jobId
        const parts = jobId.split("-");
        const companySlug = parts[0];
        const roleSlug = parts.slice(1).join("-");
        
        // Step 1: Create demo user + application
        console.log("[bg-interview] Creating demo user...");
        const demoUserId = `demo-candidate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const demoUserResp = await fetch(`/api/users/demo?skip-auth=true`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            userId: demoUserId,
            name: "Demo User"
          }),
        });
        
        if (!demoUserResp.ok) {
          throw new Error("Failed to create demo user");
        }
        
        const demoData = await demoUserResp.json();
        const createdApplicationId = demoData.applicationId;
        console.log("[bg-interview] Demo user created:", demoUserId, "Application:", createdApplicationId);
        
        // Step 2: Create interview session
        console.log("[bg-interview] Creating interview session...");
        const session = await createInterviewSession({
          applicationId: createdApplicationId,
          companyId,
          userId: demoUserId,
          isDemoMode: true,
        });
        
        if (!session?.interviewSession?.id) {
          throw new Error("Failed to create interview session");
        }
        
        const sessId = session.interviewSession.id;
        console.log("[bg-interview] Session created:", sessId);
        
        // Step 3: Fetch interview script (check cache first)
        const cacheKey = `interview-script-${jobId}`;
        let scriptData: any = null;
        
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            scriptData = JSON.parse(cached);
            console.log("[bg-interview] Script loaded from cache");
          }
        } catch (err) {
          console.warn("[bg-interview] Failed to read script cache:", err);
        }
        
        if (!scriptData) {
          console.log("[bg-interview] Fetching script from API...");
          const scriptResp = await fetch(
            `/api/interviews/script?company=${companySlug}&role=${roleSlug}`
          );
          if (!scriptResp.ok) {
            throw new Error("Failed to load interview script");
          }
          scriptData = await scriptResp.json();
          
          // Cache the script
          try {
            localStorage.setItem(cacheKey, JSON.stringify(scriptData));
            console.log("[bg-interview] Script cached");
          } catch (err) {
            console.warn("[bg-interview] Failed to cache script:", err);
          }
        }
        
        // Step 4: Generate first OpenAI question
        console.log("[bg-interview] Generating first question...");
        const companyNameFromScript = scriptData.companyName || 
          companySlug.charAt(0).toUpperCase() + companySlug.slice(1);
        const persona = buildOpenAIBackgroundPrompt(companyNameFromScript);
        const instruction = `Ask exactly: "${String(scriptData.backgroundQuestion)}"`;
        const firstQuestion = await generateAssistantReply(
          openaiClient,
          persona,
          instruction
        );
        
        if (!firstQuestion) {
          throw new Error("Failed to generate first question");
        }
        
        console.log("[bg-interview] First question generated");
        
        // Store all preloaded data in Redux
        dispatch(setPreloadedData({
          userId: demoUserId,
          applicationId: createdApplicationId,
          script: scriptData,
          preloadedFirstQuestion: firstQuestion,
        }));
        
        dispatch(setMachineSessionId({ sessionId: sessId }));
        
        dispatch(setCompanyContext({
          companyName: companyNameFromScript,
          companySlug,
          roleSlug,
        }));
        
        if (scriptData.backgroundQuestion) {
          dispatch(
            setExpectedBackgroundQuestion({
              question: String(scriptData.backgroundQuestion),
            })
          );
        }
        
        if (scriptData.codingQuestionTimeSeconds) {
          setCodingTimeChallenge(Math.round(scriptData.codingQuestionTimeSeconds / 60));
        }
        
        if (scriptData.backgroundQuestionTimeSeconds) {
          setBackgroundTimeSeconds(scriptData.backgroundQuestionTimeSeconds);
          const timeboxMs = scriptData.backgroundQuestionTimeSeconds * 1000;
          interviewChatStore.dispatch({ 
            type: "BG_GUARD_SET_TIMEBOX", 
            payload: { timeboxMs } 
          } as any);
        }
        
        // Generate announcement text
        const jobTitle = scriptData.jobTitle || roleSlug.split("-").map(
          (word: string) => word.charAt(0).toUpperCase() + word.slice(1)
        ).join(" ");
        const announcement = `Hi! Welcome to your interview for ${jobTitle} at ${companyNameFromScript}`;
        setAnnouncementText(announcement);
        
        console.log("[bg-interview] Stage 1 complete - transitioning to welcome");
        setStage('welcome');
        
      } catch (error) {
        console.error("[bg-interview] Stage 1 failed:", error);
        alert("Failed to initialize interview. Please refresh and try again.");
      }
    };

    preloadData();
  }, [stage, openaiClient, searchParams, dispatch]);

  // STAGE 2: Handle Start Interview button click
  const [isStarting, setIsStarting] = useState(false);
  
  const handleStartInterview = async () => {
    if (!name.trim()) {
      alert("Please enter your name");
      return;
    }
    
    try {
      // Play click sound and show disabled state
      setIsStarting(true);
      const clickSound = new Audio("/sounds/click-button.mp3");
      clickSound.play().catch(err => console.error("Click sound error:", err));
      
      // Wait a moment for visual/audio feedback
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Request mic permissions
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
      
      // Transition to Stage 3
      console.log("[bg-interview] Stage 2 complete - transitioning to interview");
      setStage('interview');
      
      // Start interview flow after transition
      await startInterviewFlow();
      
    } catch (error) {
      console.error("[bg-interview] Failed to start interview:", error);
      setIsStarting(false);
      alert("Microphone access is required for this interview.");
    }
  };

  // STAGE 3: Start the actual interview flow
  const startInterviewFlow = async () => {
    try {
      console.log("[bg-interview] Stage 3: Starting interview flow...");
      
      // Initialize state machine
      const firstName = name.trim().split(' ')[0];
      dispatch(start({ candidateName: firstName }));
      
      // Initialize chat store
      interviewChatStore.dispatch({ type: "SET_STAGE", payload: "background" } as any);
      interviewChatStore.dispatch({ type: "BG_GUARD_START_TIMER" } as any);
      
      // Don't add first question to chat store yet - wait for announcement to complete
      // (otherwise the chat store subscription will trigger and show the question)
      
      // Transition state machine to background mode (skip greeting)
      const firstQuestion = preloadedFirstQuestion || "";
      dispatch(aiFinal({ text: "greeting" }));
      dispatch(userFinal());
      dispatch(aiFinal({ text: firstQuestion }));
      
      console.log("[bg-interview] State machine initialized in background mode");
      
      // Wait 1 second
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Play start interview sound
      try {
        console.log("[bg-interview] Playing start-interview sound...");
        const startSound = new Audio("/sounds/start-interview.mp3");
        await new Promise<void>((resolve, reject) => {
          startSound.onended = () => {
            console.log("[bg-interview] Start-interview sound finished");
            resolve();
          };
          startSound.onerror = (error) => {
            console.error("[bg-interview] Start-interview sound error:", error);
            reject(error);
          };
          startSound.play().catch(reject);
        });
      } catch (error) {
        console.error("[bg-interview] Failed to play start-interview sound:", error);
      }
      
      // Show announcement
      setShowAnnouncement(true);
      
    } catch (error) {
      console.error("[bg-interview] Failed to start interview flow:", error);
    }
  };

  const handleAnnouncementComplete = () => {
    console.log("[bg-interview] Announcement complete, showing first question");
    setShowAnnouncement(false);
    
    // Now add first question to chat store (this will trigger the useEffect and set currentQuestion)
    const firstQuestion = preloadedFirstQuestion || "";
    interviewChatStore.dispatch({
      type: "ADD_MESSAGE",
      payload: { text: firstQuestion, speaker: "ai" },
    } as any);
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

  // STAGE 1: Loading screen
  if (stage === 'loading') {
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
          <p className="text-gray-600 text-lg">Preparing your interview...</p>
        </div>
      </div>
    );
  }

  // STAGE 2: Welcome/Name Input screen
  if (stage === 'welcome') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-3xl px-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12">
            <h1 className="text-4xl font-semibold text-gray-900 mb-6 text-center">
              Welcome to Sfinx Demo
            </h1>

            <p className="text-lg text-gray-700 mb-8 leading-relaxed">
              Experience our AI-powered interview platform from both perspectives:
              first as a candidate completing an interview, then as a hiring manager
              reviewing results and comparing candidates.
            </p>

            <div className="bg-blue-50 rounded-xl p-6 mb-8">
              <h2 className="text-xl font-medium text-gray-900 mb-4">
                What you'll experience:
              </h2>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="text-blue-600 mr-3">1.</span>
                  <span>Complete a technical interview for Frontend Engineer at Meta</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-3">2.</span>
                  <span>View your comprehensive interview analysis report</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-3">3.</span>
                  <span>See how you rank among other candidates</span>
                </li>
              </ul>
            </div>

            <div className="mb-6">
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Your Name
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && name.trim()) {
                    handleStartInterview();
                  }
                }}
                placeholder="Enter your full name"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              />
            </div>

            <button
              onClick={handleStartInterview}
              disabled={!name.trim() || isStarting}
              className="w-full bg-blue-600 text-white text-lg font-medium py-4 px-8 rounded-xl hover:bg-blue-700 transition-all duration-300 shadow-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Start
            </button>
          </div>
        </div>
      </div>
    );
  }

  // STAGE 3: Interview flow
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
            userId={userId || ""}
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
        {showAnnouncement ? (
          <AnnouncementScreen
            text={announcementText}
            onComplete={handleAnnouncementComplete}
          />
        ) : (
          <QuestionCard
            question={currentQuestion}
            onSubmitAnswer={handleSubmitAnswer}
            loading={submitting}
            micStream={micStream}
          />
        )}
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
