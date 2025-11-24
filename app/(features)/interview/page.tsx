"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import { Suspense } from "react";
import { store, RootState } from "@/shared/state/store";
import { interviewChatStore } from "@/shared/state/interviewChatStore";
import {
  start,
  aiFinal,
  reset,
  setPageLoading,
  forceCoding,
  setCompanyContext,
  setSessionId,
  setPreloadedData,
} from "@/shared/state/slices/interviewMachineSlice";
import QuestionCard from "../background-interview/components/QuestionCard";
import CompletionScreen from "../background-interview/components/CompletionScreen";
import AnnouncementScreen from "../background-interview/components/AnnouncementScreen";
import SfinxSpinner from "../background-interview/components/SfinxSpinner";
import InterviewStageScreen from "app/shared/components/InterviewStageScreen";
import { InterviewIDE } from "./components";
import { useMute } from "app/shared/contexts";
import { useScreenRecording } from "./components/hooks/useScreenRecording";
import { InterviewRecordingProvider } from "./components/InterviewRecordingContext";
import { createInterviewSession } from "./components/services/interviewSessionService";
import { createApplication } from "./components/services/applicationService";
import OpenAI from "openai";
import {
  useBackgroundPreload,
  useAnnouncementGeneration,
  useSoundPreload,
  useBackgroundAnswerHandler,
} from "@/shared/services/backgroundInterview";

/**
 * Interview Page - Unified flow: Background Q&A → Completion → Coding IDE.
 * All stages on single page with Redux state machine driving UI.
 */
function InterviewPageContent() {
  const router = useRouter();
  const { isMuted } = useMute();
  const dispatch = useDispatch();

  // Redux state
  const isPageLoading = useSelector((state: RootState) => state.interviewMachine.isPageLoading);
  const machineState = useSelector((state: RootState) => state.interviewMachine.state);
  const companyName = useSelector((state: RootState) => state.interviewMachine.companyName);
  const companySlug = useSelector((state: RootState) => state.interviewMachine.companySlug);
  const roleSlug = useSelector((state: RootState) => state.interviewMachine.roleSlug);
  const preloadedFirstQuestion = useSelector((state: RootState) => state.interviewMachine.preloadedFirstQuestion);
  const userId = useSelector((state: RootState) => state.interviewMachine.userId);
  const applicationId = useSelector((state: RootState) => state.interviewMachine.applicationId);
  const shouldResetFlag = useSelector((state: RootState) => state.interviewMachine.shouldReset);

  // Local state
  const [name, setName] = useState("");
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
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [allowQuestionDisplay, setAllowQuestionDisplay] = useState(false);
  const [showCodingIDE, setShowCodingIDE] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [codingApplicationId, setCodingApplicationId] = useState<string | null>(applicationId || null);

  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const recordingControls = useScreenRecording(isDemoMode);
  const { startRecording, interviewSessionId, setInterviewSessionId, getActualRecordingStartTime } = recordingControls;

  // Refs
  const clickSoundRef = useRef<HTMLAudioElement | null>(null);
  const startSoundRef = useRef<HTMLAudioElement | null>(null);

  // Extracted services
  const { preload } = useBackgroundPreload();
  const { generateAnnouncement } = useAnnouncementGeneration();
  const { clickSoundRef: refClickSound, startSoundRef: refStartSound, soundsReady } = useSoundPreload();
  const { handleSubmit: submitAnswer } = useBackgroundAnswerHandler();

  // Sync service sound refs to local refs
  useEffect(() => {
    clickSoundRef.current = refClickSound.current;
    startSoundRef.current = refStartSound.current;
  }, [refClickSound, refStartSound]);

  // Initialize on mount
  useEffect(() => {
    console.log("[interview] Component mounted - resetting store");
    interviewChatStore.dispatch({ type: "RESET_ALL" } as any);
    dispatch(reset());
  }, [dispatch]);

  // Initialize OpenAI client
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    if (apiKey) {
      setOpenaiClient(new OpenAI({ apiKey, dangerouslyAllowBrowser: true }));
    }
  }, []);

  useEffect(() => {
    if (applicationId) {
      setCodingApplicationId(applicationId);
    }
  }, [applicationId]);

  // Subscribe to chat store for messages
  useEffect(() => {
    const unsubscribe = interviewChatStore.subscribe(() => {
      if (!allowQuestionDisplay) return;
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
  }, [allowQuestionDisplay]);

  // Monitor machine state for completion
  useEffect(() => {
    if (machineState === "in_coding_session") {
      setCompleted(true);
    }
  }, [machineState]);

  // Cleanup mic on unmount
  useEffect(() => {
    return () => {
      if (micStream) {
        micStream.getTracks().forEach((track) => track.stop());
        console.log("[interview] Mic stream stopped on cleanup");
      }
    };
  }, [micStream]);

  // Watch for reset trigger
  useEffect(() => {
    if (shouldResetFlag) {
      console.log("[interview] Reset triggered");
      interviewChatStore.dispatch({ type: "RESET_ALL" } as any);
      setCurrentQuestion("");
      setShowHandEmoji(false);
      setShowAnnouncement(false);
      setAnnouncementText("");
      setAnnouncementAudioBlob(null);
      setIsFirstQuestion(true);
      setSubmitting(false);
      setCompleted(false);
      setName("");
      setAllowQuestionDisplay(false);
      setIsStarting(false);
      setShowCodingIDE(false);
      setCodingApplicationId(applicationId || null);
      setInterviewSessionId(null);
      dispatch(reset());
    }
  }, [shouldResetFlag, dispatch, applicationId, setInterviewSessionId]);

  // STAGE 1: Preload
  useEffect(() => {
    if (!isPageLoading || !openaiClient) return;

    const executePreload = async () => {
      try {
        // Use defaults from Redux store
        const jobId = companySlug && roleSlug ? `${companySlug}-${roleSlug}` : "meta-frontend-engineer";
        const companyId = companySlug || "meta";

        await preload(jobId, companyId, openaiClient, setCodingTimeChallenge, setBackgroundTimeSeconds);

        // Generate announcement
        const jobTitle = roleSlug?.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") || "Frontend Engineer";
        const { text, audioBlob } = await generateAnnouncement(jobTitle);
        setAnnouncementText(text);
        setAnnouncementAudioBlob(audioBlob);

        console.log("[interview] Preload complete - moving to welcome");
        dispatch(setPageLoading({ isLoading: false }));
      } catch (error) {
        console.error("[interview] Preload failed:", error);
        dispatch(setPageLoading({ isLoading: false }));
        alert("Failed to initialize interview. Please refresh and try again.");
      }
    };

    executePreload();
  }, [isPageLoading, openaiClient, dispatch, preload, generateAnnouncement]);

  /**
   * Ensures an application exists for the coding phase and returns its ID.
   */
  const resolveApplicationId = useCallback(async () => {
    if (codingApplicationId) return codingApplicationId;
    if (applicationId) {
      setCodingApplicationId(applicationId);
      return applicationId;
    }

    try {
      const jobId = companySlug && roleSlug ? `${companySlug}-${roleSlug}` : "meta-frontend-engineer";
      const companyId = companySlug || "meta";
      const application = await createApplication({
        companyId,
        jobId,
        userId: userId || undefined,
        isDemoMode,
      });
      const createdId = application?.application?.id || null;
      if (createdId) {
        setCodingApplicationId(createdId);
        dispatch(setPreloadedData({ applicationId: createdId }));
      }
      return createdId;
    } catch (error) {
      console.error("[interview] Failed to create application:", error);
      return null;
    }
  }, [codingApplicationId, applicationId, companySlug, roleSlug, userId, isDemoMode, dispatch]);

  /**
   * Starts recording immediately after the start flow and creates the coding session.
   */
  const ensureRecordingSession = useCallback(async () => {
    if (interviewSessionId) return interviewSessionId;

    try {
      const recordingStarted = await startRecording();
      if (!recordingStarted) return null;

      const resolvedApplicationId = await resolveApplicationId();
      if (!resolvedApplicationId) return null;

      const session = await createInterviewSession({
        applicationId: resolvedApplicationId,
        companyId: companySlug || "meta",
        userId: userId || undefined,
        isDemoMode,
        recordingStartedAt: getActualRecordingStartTime() || undefined,
      });
      const newSessionId = session.interviewSession.id;
      setInterviewSessionId(newSessionId);
      dispatch(setSessionId({ sessionId: newSessionId }));
      return newSessionId;
    } catch (error) {
      console.error("[interview] Failed to create recording session:", error);
      return null;
    }
  }, [
    interviewSessionId,
    startRecording,
    resolveApplicationId,
    companySlug,
    userId,
    isDemoMode,
    getActualRecordingStartTime,
    setInterviewSessionId,
    dispatch,
  ]);

  // STAGE 2: Start interview handler
  const handleStartInterview = async () => {
    if (!name.trim()) {
      alert("Please enter your name");
      return;
    }

    try {
      setShowHandEmoji(true);
      setIsStarting(true);

      if (clickSoundRef.current) {
        clickSoundRef.current.volume = isMuted ? 0 : 1;
        clickSoundRef.current.currentTime = 0;
        clickSoundRef.current.play().catch(console.error);
      }

      // Update user name
      await fetch(`/api/users/${userId}/name?skip-auth=true`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });

      // Request mic permissions
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      setMicStream(stream);

      const activeSessionId = await ensureRecordingSession();
      if (!activeSessionId) {
        setIsStarting(false);
        alert("Screen recording is required.");
        return;
      }

      await startInterviewFlow();
    } catch (error) {
      console.error("[interview] Start failed:", error);
      setIsStarting(false);
      alert("Microphone access is required.");
    }
  };

  // STAGE 3: Start interview flow
  const startInterviewFlow = async () => {
    try {
      const firstName = name.trim().split(" ")[0];
      dispatch(start({ candidateName: firstName }));
      dispatch(aiFinal({ text: "greeting" }));
      interviewChatStore.dispatch({ type: "SET_STAGE", payload: "background" } as any);

      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (startSoundRef.current) {
        try {
          await new Promise<void>((resolve) => {
            const startSound = startSoundRef.current!;
            startSound.volume = isMuted ? 0 : 1;
            startSound.currentTime = 0;
            startSound.onended = () => resolve();
            startSound.onerror = () => resolve();
            startSound.play().catch(() => resolve());
          });
        } catch {}
      }

      setShowAnnouncement(true);
    } catch (error) {
      console.error("[interview] Start flow failed:", error);
    }
  };

  // Announcement complete handler
  const handleAnnouncementComplete = useCallback(() => {
    console.log("[interview] Announcement complete");
    setShowAnnouncement(false);
    setAllowQuestionDisplay(true);
    const firstQuestion = preloadedFirstQuestion || "";
    dispatch(aiFinal({ text: firstQuestion }));
    setCurrentQuestion(firstQuestion);
    interviewChatStore.dispatch({
      type: "ADD_MESSAGE",
      payload: { text: firstQuestion, speaker: "ai" },
    } as any);
  }, [preloadedFirstQuestion, dispatch]);

  // Answer submission handler
  const handleSubmitAnswer = async (answer: string) => {
    if (!openaiClient) return;
    setSubmitting(true);

    try {
      setIsFirstQuestion(false);
      const result = await submitAnswer(answer, openaiClient, name);

      if (result.shouldComplete) {
        setCompleted(true);
      } else {
        setSubmitting(false);
      }
    } catch (error) {
      console.error("[interview] Answer submit failed:", error);
    } finally {
      setSubmitting(false);
    }
  };

  // Start coding handler
  const handleStartCoding = () => {
    // Dispatch company context (already in Redux from preload, but ensure it's set)
    dispatch(setCompanyContext({
      companyName: companyName || (companySlug ? companySlug.charAt(0).toUpperCase() + companySlug.slice(1) : "Meta"),
      companySlug: companySlug || "meta",
      roleSlug: roleSlug || "frontend-engineer",
    }));
    dispatch(forceCoding());
    interviewChatStore.dispatch({ type: "SET_STAGE", payload: "coding" } as any);
    setShowCodingIDE(true);
  };

  // ===== RENDER CONDITIONS =====

  if (isPageLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white flex items-center justify-center p-4">
        <SfinxSpinner size="lg" />
      </div>
    );
  }

  if (!isPageLoading && machineState === "idle") {
    return (
      <InterviewStageScreen
        onSubmit={handleStartInterview}
        ctaText="Start"
        ctaDisabled={!name.trim() || !soundsReady || isStarting}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <div className="bg-white rounded-2xl p-8 border-2 border-sfinx-purple shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-sfinx-purple text-white flex items-center justify-center font-bold">
                1
              </div>
              <h2 className="text-2xl font-semibold text-gray-900">Candidate</h2>
            </div>
            <p className="text-gray-600">Complete a screening interview for a Frontend Engineer role</p>
          </div>
          <div className="bg-white rounded-2xl p-8 border-2 border-gray-200 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gray-300 text-gray-600 flex items-center justify-center font-bold">
                2
              </div>
              <h2 className="text-2xl font-semibold text-gray-900">Company</h2>
            </div>
            <p className="text-gray-600">Review results, compare candidates, and see detailed analytics</p>
          </div>
        </div>
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
                if (e.key === "Enter" && name.trim()) handleStartInterview();
              }}
              placeholder="Enter your full name"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-sfinx-purple focus:border-transparent outline-none transition-all"
            />
          </div>
        </div>
      </InterviewStageScreen>
    );
  }

  if (machineState === "in_coding_session" && showCodingIDE) {
    return (
      <InterviewRecordingProvider value={recordingControls}>
        <InterviewIDE />
      </InterviewRecordingProvider>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white flex flex-col relative">
        <div className="flex-1 flex items-center justify-center p-4">
          <CompletionScreen
            codingTimeChallenge={codingTimeChallenge}
            onStartCoding={handleStartCoding}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white flex flex-col relative">
      <div className="flex-1 flex items-center justify-center p-4">
        {showHandEmoji && !showAnnouncement && !currentQuestion ? (
          <div className="flex items-start justify-start gap-4 w-full max-w-4xl">
            <div className="text-5xl flex-shrink-0">👋</div>
          </div>
        ) : showAnnouncement ? (
          <AnnouncementScreen
            key={announcementText}
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
    </div>
  );
}

export default function InterviewPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <InterviewPageContent />
    </Suspense>
  );
}
