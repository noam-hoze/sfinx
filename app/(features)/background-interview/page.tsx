"use client";

import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
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
import SfinxSpinner from "./components/SfinxSpinner";
import InterviewStageScreen from "app/shared/components/InterviewStageScreen";
import { useMute } from "app/shared/contexts";
import OpenAI from "openai";
import { buildOpenAIBackgroundPrompt } from "@/shared/prompts/openAIInterviewerPrompt";
import {
  askViaChatCompletion,
  runBackgroundControl,
  generateAssistantReply,
} from "../interview/components/chat/openAITextConversationHelpers";
import { stopCheck } from "@/shared/services/weightedMean/scorer";
import { shouldTransition } from "@/shared/services/backgroundSessionGuard";
import { createInterviewSession } from "../interview/components/services/interviewSessionService";
import { buildControlContextMessages, CONTROL_CONTEXT_TURNS } from "../../shared/services";

type Stage = 'loading' | 'welcome' | 'interview';

export default function BackgroundInterviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isMuted } = useMute();
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
  const [showHandEmoji, setShowHandEmoji] = useState(false);
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [announcementText, setAnnouncementText] = useState("");
  const [announcementAudioBlob, setAnnouncementAudioBlob] = useState<Blob | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<string>("");
  const [isFirstQuestion, setIsFirstQuestion] = useState(true);
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
        
        // Generate announcement text and TTS
        const jobTitle = scriptData.jobTitle || roleSlug.split("-").map(
          (word: string) => word.charAt(0).toUpperCase() + word.slice(1)
        ).join(" ");
        const announcement = `Hi! Welcome to your interview for ${jobTitle} at ${companyNameFromScript}`;
        setAnnouncementText(announcement);
        
        // Pre-generate announcement TTS
        console.log("[bg-interview] Pre-generating announcement TTS...");
        try {
          const ttsResp = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: announcement }),
          });
          if (ttsResp.ok) {
            const audioBuffer = await ttsResp.arrayBuffer();
            const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" });
            setAnnouncementAudioBlob(audioBlob);
            console.log("[bg-interview] Announcement TTS pre-generated");
          } else {
            console.warn("[bg-interview] Failed to pre-generate announcement TTS");
          }
        } catch (err) {
          console.warn("[bg-interview] Error pre-generating announcement TTS:", err);
        }
        
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
      // Show hand emoji immediately
      setShowHandEmoji(true);
      
      // Play click sound and show disabled state
      setIsStarting(true);
      const clickSound = new Audio("/sounds/click-button.mp3");
      clickSound.volume = isMuted ? 0 : 1;
      clickSound.play().catch(err => console.error("Click sound error:", err));
      
      // Request mic permissions (no delay)
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
      
      // Update URL to reflect stage change
      const url = new URL(window.location.href);
      url.searchParams.set('stage', 'interview');
      window.history.pushState({}, '', url);
      
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
      
      // Play start interview sound and wait for it to finish
      try {
        console.log("[bg-interview] Playing start-interview sound...");
        await new Promise<void>((resolve, reject) => {
          const startSound = new Audio("/sounds/start-interview.mp3");
          startSound.volume = isMuted ? 0 : 1;
          startSound.onended = () => {
            console.log("[bg-interview] Start-interview sound finished");
            resolve();
          };
          startSound.onerror = (error) => {
            console.error("[bg-interview] Start-interview sound error:", error);
            reject(error);
          };
          startSound.play().catch(err => {
            console.error("[bg-interview] Failed to play start-interview sound:", err);
            reject(err);
          });
        });
      } catch (error) {
        console.error("[bg-interview] Start-interview sound failed, continuing anyway:", error);
      }
      
      // Show announcement after sound finishes
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
      // Mark that we're past the first question
      setIsFirstQuestion(false);
      
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

        // Check if gate is satisfied (use same logic as state machine)
        const chatState = interviewChatStore.getState();
        const scorer = chatState.background?.scorer;
        const coverage = chatState.background?.coverage;
        const consecutiveUselessAnswers = chatState.background.consecutiveUselessAnswers;
        const timeboxMs = chatState.background.timeboxMs;
        const startedAtMs = chatState.background.startedAtMs;
        const gateReady = !!(scorer && coverage && stopCheck(scorer, coverage));
        const transitionReason = shouldTransition(
          {
            startedAtMs,
            consecutiveUselessAnswers: consecutiveUselessAnswers ?? 0,
            timeboxMs,
          },
          { gateReady, timeboxMs }
        );
        
        console.log("[bg-interview] Gate check:", {
          gateReady,
          transitionReason,
          scorer: scorer ? "present" : "missing",
          coverage,
          consecutiveUselessAnswers,
        });

        if (transitionReason) {
          // Gate satisfied - show completion screen (transition to coding happens when interview page loads)
          console.log(`[bg-interview] Gate satisfied (${transitionReason}) - moving to completion`);
          
          // Show completion screen to unmount QuestionCard and prevent TTS
          setCompleted(true);
          
          // THEN generate final AI response (won't be narrated since QuestionCard is unmounted)
          try {
            const persona = buildOpenAIBackgroundPrompt(String(companyName));
            const firstName = name.trim().split(' ')[0] || "Candidate";
            const closingInstruction = `Say exactly: "Thank you so much ${firstName}, the next steps will be shared with you shortly."`;
            const finalResponse = await generateAssistantReply(openaiClient, persona, closingInstruction);
            console.log("[bg-interview] ✓ Final AI response (NOT NARRATED - transition to coding):", finalResponse);
            
            // Add to chat store for history only (QuestionCard already unmounted)
            interviewChatStore.dispatch({
              type: "ADD_MESSAGE",
              payload: { text: finalResponse || "", speaker: "ai" },
            } as any);
            
            // Add system message indicating this response was not delivered/narrated
            interviewChatStore.dispatch({
              type: "ADD_MESSAGE",
              payload: { 
                text: "[SYSTEM: Previous AI message was generated but not narrated to candidate - background interview ended, transitioning to coding stage]", 
                speaker: "system" as any 
              },
            } as any);
          } catch (error) {
            console.error("[bg-interview] Failed to generate final response:", error);
          }
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

            // Clear loading state before showing new question
            setSubmitting(false);
            console.log("[bg-interview] Submitting state cleared");

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
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white flex items-center justify-center p-4">
        <SfinxSpinner size="lg" />
      </div>
    );
  }

  // STAGE 2: Welcome/Name Input screen
  if (stage === 'welcome') {
    return (
      <InterviewStageScreen
        onSubmit={handleStartInterview}
        ctaText="Start"
        ctaDisabled={!name.trim()}
      >
        {/* Two-stage flow visualization */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {/* Stage 1: Candidate */}
          <div className="bg-white rounded-2xl p-8 border-2 border-sfinx-purple shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-sfinx-purple text-white flex items-center justify-center font-bold">
                1
              </div>
              <h2 className="text-2xl font-semibold text-gray-900">Candidate</h2>
            </div>
            <p className="text-gray-600">
              Complete a technical interview for Frontend Engineer at Meta
            </p>
          </div>

          {/* Stage 2: Company */}
          <div className="bg-white rounded-2xl p-8 border-2 border-gray-200 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gray-300 text-gray-600 flex items-center justify-center font-bold">
                2
              </div>
              <h2 className="text-2xl font-semibold text-gray-900">Company</h2>
            </div>
            <p className="text-gray-600">
              Review results, compare candidates, and see detailed analytics
            </p>
          </div>
        </div>

        {/* Name input */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-6">
          <div className="mb-6">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Candidate&apos;s Name
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
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-sfinx-purple focus:border-transparent outline-none transition-all"
            />
          </div>
        </div>
      </InterviewStageScreen>
    );
  }

  // STAGE 3: Interview flow
  if (completed) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col relative">
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
        <div className="flex-1 flex items-center justify-center p-4">
          <CompletionScreen
            codingTimeChallenge={codingTimeChallenge}
            onStartCoding={() => {}}
            jobId={searchParams.get("jobId") || "meta-frontend-engineer"}
            userId={userId || ""}
            companyId={searchParams.get("companyId") || "meta"}
            applicationId={applicationId || ""}
          />
        </div>

        {/* Debug panel - fixed at bottom, horizontal */}
        {showDebugPanel && (
          <div className="border-t border-gray-300 bg-white p-4 overflow-x-auto">
            <BackgroundDebugPanel 
              timeboxMs={backgroundTimeSeconds ? backgroundTimeSeconds * 1000 : undefined}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col relative">
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
      <div className="flex-1 flex items-center justify-center p-4">
        {showHandEmoji && !showAnnouncement && !currentQuestion ? (
          <div className="flex items-start justify-start gap-4 w-full max-w-4xl">
            <div className="text-5xl flex-shrink-0">👋</div>
          </div>
        ) : showAnnouncement ? (
          <AnnouncementScreen
            text={announcementText}
            preloadedAudioBlob={announcementAudioBlob}
            onComplete={handleAnnouncementComplete}
          />
        ) : (
          <QuestionCard
            question={currentQuestion}
            onSubmitAnswer={handleSubmitAnswer}
            loading={submitting}
            micStream={micStream}
            isFirstQuestion={isFirstQuestion}
          />
        )}
      </div>

      {/* Debug panel - fixed at bottom, horizontal */}
      {showDebugPanel && (
        <div className="border-t border-gray-300 bg-white p-4 overflow-x-auto">
          <BackgroundDebugPanel 
            timeboxMs={backgroundTimeSeconds ? backgroundTimeSeconds * 1000 : undefined}
          />
        </div>
      )}
    </div>
  );
}
