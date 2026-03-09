"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { Menu } from "@headlessui/react";
import { log } from "app/shared/services/logger";
import SfinxLogo from "app/shared/components/SfinxLogo";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";
import { store, RootState } from "@/shared/state/store";
import {
  addMessage,
  startTimer,
} from "@/shared/state/slices/backgroundSlice";
import {
  start,
  setCompanyContext,
  setSessionId,
  setPreloadedData,
  setStage,
  resetInterview,
} from "@/shared/state/slices/interviewSlice";
import QuestionCard from "./components/backgroundInterview/QuestionCard";
import CompletionScreen from "./components/backgroundInterview/CompletionScreen";
import AnnouncementScreen from "./components/backgroundInterview/AnnouncementScreen";
import PreInterviewScreen from "./components/backgroundInterview/PreInterviewScreen";
import SfinxSpinner from "app/shared/components/SfinxSpinner";
import AuthGuard from "app/shared/components/AuthGuard";
import Breadcrumbs from "app/shared/components/Breadcrumbs";
import InterviewStageScreen from "app/shared/components/InterviewStageScreen";
import { InterviewIDE } from "./components";
import CameraPreview from "./components/CameraPreview";
import AIInterviewerBox from "./components/AIInterviewerBox";
import { useMute, useInterviewPreload } from "app/shared/contexts";
import { useCamera } from "./components/hooks/useCamera";
import { useScreenRecording } from "./components/hooks/useScreenRecording";
import { InterviewRecordingProvider } from "./components/InterviewRecordingContext";
import { createInterviewSession } from "./components/services/interviewSessionService";
import { createApplication } from "./components/services/applicationService";
import { getBreadcrumbTrail } from "app/shared/config/navigation";
import { useDebug } from "app/shared/contexts";
import BackgroundDebugPanel from "app/shared/components/BackgroundDebugPanel";
import OpenAI from "openai";
import {
  useBackgroundPreload,
  useAnnouncementGeneration,
  useBackgroundAnswerHandler,
} from "@/shared/services/backgroundInterview";

/**
 * Interview Page - Unified flow: Background Q&A → Completion → Coding IDE.
 * All stages on single page with Redux state machine driving UI.
 */
const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEWS;

function mapInterviewEntryError(error: unknown): { title: string; description: string } {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("Missing required URL parameters")) {
    return {
      title: "This interview link is incomplete",
      description: "The link is missing job information. Please ask the company to send a new interview link.",
    };
  }

  if (message.includes("Job does not belong to this company")) {
    return {
      title: "This interview link is invalid",
      description: "The job and company in this link do not match. Please ask the company to resend the link.",
    };
  }

  if (message.includes("Interview content missing")) {
    return {
      title: "This interview is not ready yet",
      description: "The company has not finished configuring interview content for this job.",
    };
  }

  if (message.includes("Job not found")) {
    return {
      title: "This interview link is no longer available",
      description: "The job could not be found. Please ask the company to confirm the interview link.",
    };
  }

  return {
    title: "Failed to initialize interview",
    description: "Please refresh and try again. If the issue continues, ask the company to resend the interview link.",
  };
}

function InterviewPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isMuted, toggleMute } = useMute();
  const {
    warmupData,
    warmupLoading,
    clickSoundRef: preloadedClickSoundRef,
    startSoundRef: preloadedStartSoundRef,
  } = useInterviewPreload();
  const { isDebugVisible, showDebugButton, setShowDebugButton } = useDebug();
  const dispatch = useDispatch();
  const { data: session, status: sessionStatus } = useSession();

  // Local loading state for preload phase
  const [isPreloading, setIsPreloading] = useState(true);
  const [showPreInterviewScreen, setShowPreInterviewScreen] = useState(false);
  const [preInterviewNotice, setPreInterviewNotice] = useState<{ title: string; description: string } | null>(null);
  const [entryError, setEntryError] = useState<{ title: string; description: string } | null>(null);
  
  // Redux state
  const stage = useSelector((state: RootState) => state.interview.stage);
  const { isCameraOn, selfVideoRef } = useCamera();
  const companyName = useSelector((state: RootState) => state.interview.companyName);
  const companyId = useSelector((state: RootState) => state.interview.companyId);
  const currentJobId = useSelector((state: RootState) => state.interview.jobId);
  const currentJobTitle = useSelector((state: RootState) => state.interview.jobTitle);
  const backgroundStartedAtMs = useSelector((state: RootState) => state.background.startedAtMs);
  const backgroundTimeboxMs = useSelector((state: RootState) => state.background.timeboxMs);
  const preloadedFirstQuestion = useSelector((state: RootState) => state.interview.preloadedFirstQuestion);
  const preloadedFirstIntent = useSelector((state: RootState) => state.interview.preloadedFirstIntent);
  const userId = useSelector((state: RootState) => state.interview.userId);
  const applicationId = useSelector((state: RootState) => state.interview.applicationId);
  const shouldResetFlag = useSelector((state: RootState) => state.interview.shouldReset);
  const reduxSessionId = useSelector((state: RootState) => state.interview.sessionId);

  // Local state
  const [name, setName] = useState("");
  const [showHandEmoji, setShowHandEmoji] = useState(false);
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [isArriving, setIsArriving] = useState(false);
  const [announcementText, setAnnouncementText] = useState("");
  const [announcementAudioBlob, setAnnouncementAudioBlob] = useState<Blob | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<string>("");
  const [isFirstQuestion, setIsFirstQuestion] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [backgroundTimeSeconds, setBackgroundTimeSeconds] = useState<number | undefined>(undefined);
  const [experienceCategories, setExperienceCategories] = useState<Array<{name: string; description: string; weight: number; example?: string}> | null>(null);
  const [backgroundEvaluations, setBackgroundEvaluations] = useState<Array<{timestamp: string; question: string; answer: string; evaluations: any[]}>>([]);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [allowQuestionDisplay, setAllowQuestionDisplay] = useState(false);
  const [showCodingIDE, setShowCodingIDE] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [codingApplicationId, setCodingApplicationId] = useState<string | null>(applicationId || null);
  const [backgroundQuestionNumber, setBackgroundQuestionNumber] = useState(1);
  const [isAIAudioPlaying, setIsAIAudioPlaying] = useState(false);
  const [currentVisemes, setCurrentVisemes] = useState<import("@/shared/types/mascot").Viseme[]>([]);
  const [showCameraGlow, setShowCameraGlow] = useState(false);
  const [isUserRecording, setIsUserRecording] = useState(false);
  const [currentIntent, setCurrentIntent] = useState<string>("");
  const [pendingIntent, setPendingIntent] = useState<string>("");
  const [backgroundNowMs, setBackgroundNowMs] = useState<number>(Date.now());

  const skipToCoding = process.env.NEXT_PUBLIC_SKIP_TO_CODING === "true";
  const skipScreenShare = process.env.NEXT_PUBLIC_SKIP_SCREEN_SHARE === "true";
  const recordingControls = useScreenRecording();
  const { startRecording, interviewSessionId, setInterviewSessionId, getActualRecordingStartTime } = recordingControls;

  // Build breadcrumb trail
  const breadcrumbTrail = getBreadcrumbTrail("/interview", "CANDIDATE", {
    companyName: companyName ?? "",
    jobTitle: currentJobTitle ?? ""
  });

  // Refs
  const clickSoundRef = useRef<HTMLAudioElement | null>(null);
  const startSoundRef = useRef<HTMLAudioElement | null>(null);
  const interviewSessionIdRef = useRef<string | null>(null);
  const completedRef = useRef<boolean>(false);
  const hasAutoStartedRef = useRef<boolean>(false);
  const hasPreloadedRef = useRef<boolean>(false);
  const skipToCodingStartAttemptedRef = useRef<boolean>(false);

  // Extracted services
  const { preload } = useBackgroundPreload();
  const { generateAnnouncement } = useAnnouncementGeneration();
  // Sound refs come from InterviewPreloadContext (preloaded at auth time)
  const { handleSubmit: submitAnswer } = useBackgroundAnswerHandler(
    (evalData) => {
      setBackgroundEvaluations(prev => [...prev, evalData]);
    },
    (intent) => {
      setPendingIntent(intent);
    }
  );

  // Sync preloaded sound refs to local refs
  useEffect(() => {
    clickSoundRef.current = preloadedClickSoundRef.current;
    startSoundRef.current = preloadedStartSoundRef.current;
  }, [preloadedClickSoundRef, preloadedStartSoundRef]);

  // Cleanup on unmount - reset all interview state when leaving the flow
  useEffect(() => {
    setShowDebugButton(true);
    return () => {
      log.info(LOG_CATEGORY, "[interview] Component unmounting - cleaning up state");
      dispatch(resetInterview());
      setShowDebugButton(false);
    };
  }, [dispatch, setShowDebugButton]);

  // Skip preload if going directly to coding
  useEffect(() => {
    if (skipToCoding && isPreloading) {
      log.info(LOG_CATEGORY, "[interview] Skip-to-coding mode: bypassing preload");
      
      const setupUserId = async () => {
        const urlCompanyId = searchParams.get("companyId");
        const urlJobId = searchParams.get("jobId");
        if (urlCompanyId && urlJobId) {
          dispatch(setCompanyContext({ companyId: urlCompanyId, jobId: urlJobId }));
        }

        // Try to use session userId first
        const sessionUserId = (session?.user as any)?.id;
        if (sessionUserId) {
          dispatch(setPreloadedData({ userId: sessionUserId }));
          log.info(LOG_CATEGORY, "[interview] Set userId from session:", sessionUserId);
          setIsPreloading(false);
          return;
        }
        
        setIsPreloading(false);
      };
      
      setupUserId();
    }
  }, [skipToCoding, isPreloading, session, dispatch, companyId, currentJobId, searchParams]);

  useEffect(() => {
    if (applicationId) {
      setCodingApplicationId(applicationId);
    }
  }, [applicationId]);

  // Get messages from Redux
  const messages = useSelector((state: RootState) => state.background.messages);
  
  // Update current question when messages change
  useEffect(() => {
    if (!allowQuestionDisplay) return;
    if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage.speaker === "ai" && lastMessage.text !== currentQuestion) {
          setCurrentQuestion(lastMessage.text);
          // Increment question number for next answer
          if (currentQuestion !== "") {
            setBackgroundQuestionNumber(prev => prev + 1);
          }
        }
      }
  }, [allowQuestionDisplay, currentQuestion, messages, backgroundQuestionNumber]);

  // Reset glow states when question changes
  useEffect(() => {
    if (currentQuestion) {
      setIsAIAudioPlaying(false);
      setCurrentVisemes([]);  // Clear visemes to prevent overlap between questions
      setShowCameraGlow(false);
      setIsUserRecording(false);
    }
  }, [currentQuestion]);

  // Handle camera glow immediately when audio ends
  useEffect(() => {
    if (!isAIAudioPlaying) {
      setShowCameraGlow(true);
    } else {
      setShowCameraGlow(false);
    }
  }, [isAIAudioPlaying]);

  // Keep refs in sync with current values
  useEffect(() => {
    interviewSessionIdRef.current = interviewSessionId;
  }, [interviewSessionId]);

  useEffect(() => {
    completedRef.current = completed;
  }, [completed]);

  // Monitor stage for completion
  useEffect(() => {
    if (stage === "coding") {
      setCompleted(true);
    }
  }, [stage]);

  // Cleanup mic on unmount
  useEffect(() => {
    return () => {
      if (micStream) {
        micStream.getTracks().forEach((track) => track.stop());
        log.info(LOG_CATEGORY, "[interview] Mic stream stopped on cleanup");
      }
    };
  }, [micStream]);

  // Session cleanup: terminate session when leaving interview page
  useEffect(() => {
    // Only run cleanup on actual unmount, not on dependency changes
    return () => {
      const sessionId = interviewSessionIdRef.current;
      const isCompleted = completedRef.current;

      if (!sessionId || isCompleted) {
        log.info(LOG_CATEGORY, "[interview] Skipping cleanup - sessionId:", sessionId, "completed:", isCompleted);
        return;
      }

      log.info(LOG_CATEGORY, "[interview] Component unmounting - terminating session:", sessionId);

      // Stop recording
      try {
        recordingControls.stopRecording();
      } catch (error) {
        log.error(LOG_CATEGORY, "[interview] Error stopping recording:", error);
      }

      // Stop mic stream
      if (micStream) {
        micStream.getTracks().forEach((track) => track.stop());
      }

      // Mark session as abandoned in backend
      const url = `/api/interviews/session/${sessionId}/terminate`;

      // Use fetch without await (fire and forget on unmount)
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }).catch((error) => {
        log.error(LOG_CATEGORY, "[interview] Error terminating session:", error);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup on page close/refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!interviewSessionId || completed) return;

      log.info(LOG_CATEGORY, "[interview] Page closing - terminating session");

      // Stop recording synchronously
      try {
        recordingControls.stopRecording();
      } catch (error) {
        log.error(LOG_CATEGORY, "[interview] Error stopping recording:", error);
      }

      // Stop mic stream
      if (micStream) {
        micStream.getTracks().forEach((track) => track.stop());
      }

      // Use sendBeacon for reliable delivery as page closes
      const url = `/api/interviews/session/${interviewSessionId}/terminate`;

      navigator.sendBeacon(url, new Blob([], { type: "application/json" }));
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [interviewSessionId, completed, micStream, recordingControls]);

  // Watch for reset trigger
  useEffect(() => {
    if (shouldResetFlag) {
      log.info(LOG_CATEGORY, "[interview] Reset triggered");
      dispatch(resetInterview());
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
      setBackgroundQuestionNumber(1);
      setInterviewSessionId(null);
      setEntryError(null);
      hasAutoStartedRef.current = false;
      hasPreloadedRef.current = false;
    }
  }, [shouldResetFlag, dispatch, applicationId, setInterviewSessionId]);

  // STAGE 1: Preload (skip if going directly to coding)
  // Wait for warmup to complete (or fail) before starting preload to maximize warmup benefit
  useEffect(() => {
    if (skipToCoding || hasPreloadedRef.current || sessionStatus !== "authenticated" || warmupLoading) return;

    const executePreload = async () => {
      try {
        setIsPreloading(true);
        hasPreloadedRef.current = true;

        const urlCompanyId = searchParams.get("companyId");
        const urlJobId = searchParams.get("jobId");

        if (!urlCompanyId || !urlJobId) {
          throw new Error("Missing required URL parameters: companyId and jobId");
        }

        // Pass session userId and warmup data for optimized parallel preload
        const sessionUserId = (session?.user as any)?.id;

        const preloadResult = await preload(
          urlJobId,
          urlCompanyId,
          sessionUserId,
          warmupData,
          setBackgroundTimeSeconds,
          setExperienceCategories
        );
        const announcementResult = await generateAnnouncement(
          preloadResult.scriptData?.jobTitle || "this role"
        );

        setAnnouncementText(announcementResult.text);
        setAnnouncementAudioBlob(announcementResult.audioBlob);
        setEntryError(null);

        log.info(LOG_CATEGORY, "[interview] Preload complete - moving to welcome");
        setIsPreloading(false);
        setShowPreInterviewScreen(true);
      } catch (error) {
        log.error(LOG_CATEGORY, "[interview] Preload failed:", error);
        setIsPreloading(false);
        setEntryError(mapInterviewEntryError(error));
      }
    };

    executePreload();
  }, [skipToCoding, preload, generateAnnouncement, session, searchParams, sessionStatus, warmupData, warmupLoading]);

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
      if (!companyId || !currentJobId) {
        throw new Error("Interview context is missing companyId or jobId");
      }
      const application = await createApplication({
        companyId,
        jobId: currentJobId,
        userId: userId || undefined,
      });
      const createdId = application?.application?.id || null;
      if (createdId) {
        setCodingApplicationId(createdId);
        dispatch(setPreloadedData({ applicationId: createdId }));
      }
      return createdId;
    } catch (error) {
      log.error(LOG_CATEGORY, "[interview] Failed to create application:", error);
      return null;
    }
  }, [codingApplicationId, applicationId, companyId, currentJobId, userId, dispatch]);

  /**
   * Starts recording immediately after the start flow and creates the coding session.
   */
  const ensureRecordingSession = useCallback(async () => {
    // Check local state first
    if (interviewSessionId) {
      return interviewSessionId;
    }

    // Check Redux state - preload may have already created it
    if (reduxSessionId) {
      const recordingStarted = await startRecording();
      if (!recordingStarted) return null;

      // Warmup sessions are created before recording starts — patch
      // recordingStartedAt now so evidence clip offsets are correct.
      const actualStart = getActualRecordingStartTime();
      if (actualStart) {
        try {
          await fetch(`/api/interviews/session/${reduxSessionId}/update-recording-start`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ recordingStartedAt: actualStart.toISOString() }),
          });
        } catch (err) {
          log.error(LOG_CATEGORY, "[interview] Failed to patch recordingStartedAt:", err);
        }
      }

      setInterviewSessionId(reduxSessionId);
      return reduxSessionId;
    }

    // No existing session - create a new one
    try {
      const recordingStarted = await startRecording();
      if (!recordingStarted) return null;

      const resolvedApplicationId = await resolveApplicationId();
      if (!resolvedApplicationId) return null;

      if (!companyId) {
        throw new Error("companyId is required to create interview session");
      }
      const session = await createInterviewSession({
        applicationId: resolvedApplicationId,
        companyId,
        userId: userId || undefined,
        recordingStartedAt: getActualRecordingStartTime() || undefined,
      });
      const newSessionId = session.interviewSession.id;
      
      setInterviewSessionId(newSessionId);
      dispatch(setSessionId({ sessionId: newSessionId }));
      
      return newSessionId;
    } catch (error) {
      log.error(LOG_CATEGORY, "[interview] Failed to create recording session:", error);
      return null;
    }
  }, [
    interviewSessionId,
    reduxSessionId,
    startRecording,
    resolveApplicationId,
    companyId,
    userId,
    getActualRecordingStartTime,
    setInterviewSessionId,
    dispatch,
  ]);

  /**
   * Handles the "Start Interview" button click from PreInterviewScreen.
   * Requests mic/screen permissions and starts the background interview.
   */
  const handleStartInterviewClick = useCallback(async () => {
    if (isStarting || showAnnouncement || stage !== null || hasAutoStartedRef.current) {
      return;
    }

    try {
      hasAutoStartedRef.current = true;
      setPreInterviewNotice(null);
      setIsStarting(true);
      log.info(LOG_CATEGORY, "[interview] Starting interview from PreInterviewScreen");

      // Request mic permissions
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      setMicStream(stream);

      const activeSessionId = await ensureRecordingSession();
      if (!activeSessionId) {
        setIsStarting(false);
        hasAutoStartedRef.current = false;
        setPreInterviewNotice({
          title: "Screen sharing is required to continue",
          description: "It looks like screen sharing was canceled. Please click Start Interview again and select your full screen.",
        });
        return;
      }

      // Get user's name from session
      const userName = (session?.user as any)?.name || "there";
      const firstName = userName.trim().split(" ")[0];
      
      dispatch(start({ candidateName: firstName }));
      dispatch(setStage({ stage: "background" }));

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

      setShowPreInterviewScreen(false);
      setIsArriving(true);
      setShowAnnouncement(true);
      setIsStarting(false);
    } catch (error) {
      log.error(LOG_CATEGORY, "[interview] Start interview failed:", error);
      setIsStarting(false);
      hasAutoStartedRef.current = false;
      setPreInterviewNotice({
        title: "Microphone access is required",
        description: "Please allow microphone access and click Start Interview again.",
      });
    }
  }, [isStarting, showAnnouncement, stage, session, ensureRecordingSession, dispatch, isMuted]);

  // Auto-start interview for authenticated users after preload
  useEffect(() => {
    // CRITICAL: Skip this effect - recording/mic now triggered by PreInterviewScreen button
    return;
  }, []);

  useEffect(() => {
    if (!skipToCoding) {
      skipToCodingStartAttemptedRef.current = false;
    }
  }, [skipToCoding]);

  // Auto-skip to coding when flag is set and user is logged in
  useEffect(() => {
    log.info(LOG_CATEGORY, "[interview] Auto-skip check:", { skipToCoding, userId, showCodingIDE, isStarting, isPreloading, skipScreenShare });
    
    if (!skipToCoding || !userId || showCodingIDE || isStarting || isPreloading || !companyId || !currentJobId || skipToCodingStartAttemptedRef.current) return;

    const initializeCodingSession = async () => {
      try {
        skipToCodingStartAttemptedRef.current = true;
        setIsStarting(true);
        log.info(LOG_CATEGORY, "[interview] Skip-to-coding mode: initializing");

        let activeSessionId = null;
        
        if (skipScreenShare) {
          // Skip recording entirely - just create session without recording
          log.info(LOG_CATEGORY, "[interview] Skipping screen recording (NEXT_PUBLIC_SKIP_SCREEN_SHARE=true)");
          const resolvedApplicationId = await resolveApplicationId();
          if (resolvedApplicationId) {
            const session = await createInterviewSession({
              applicationId: resolvedApplicationId,
              companyId,
              userId: userId || undefined,
            });
            activeSessionId = session.interviewSession.id;
            setInterviewSessionId(activeSessionId);
            dispatch(setSessionId({ sessionId: activeSessionId }));
          }
        } else {
          // Normal flow with recording
          activeSessionId = await ensureRecordingSession();
          if (!activeSessionId) {
            log.warn(LOG_CATEGORY, "[interview] Screen-share was cancelled during skip-to-coding; falling back to pre-interview screen");
            setPreInterviewNotice({
              title: "Screen sharing was canceled",
              description: "To continue, click Start Interview and choose your full screen in the share dialog.",
            });
            setShowPreInterviewScreen(true);
            setIsStarting(false);
            return;
          }
        }

        dispatch(setCompanyContext({
          companyName: companyName ?? "Interview",
          companyId,
          jobId: currentJobId,
          jobTitle: currentJobTitle,
        }));
        dispatch(setStage({ stage: "coding" }));
        setShowCodingIDE(true);
        setIsStarting(false);
        log.info(LOG_CATEGORY, "[interview] Skip-to-coding complete");
      } catch (error) {
        log.error(LOG_CATEGORY, "[interview] Skip-to-coding failed:", error);
        setPreInterviewNotice({
          title: "Couldn't start coding automatically",
          description: "You can continue from the pre-interview screen by clicking Start Interview.",
        });
        setShowPreInterviewScreen(true);
        setIsStarting(false);
      }
    };

    initializeCodingSession();
  }, [skipToCoding, userId, showCodingIDE, isStarting, isPreloading, skipScreenShare, ensureRecordingSession, resolveApplicationId, setInterviewSessionId, dispatch, companyName, companyId, currentJobId, currentJobTitle]);

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
        clickSoundRef.current.play().catch((err) => log.error(LOG_CATEGORY, err));
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
        setPreInterviewNotice({
          title: "Screen sharing is required to continue",
          description: "It looks like screen sharing was canceled. Please click Start Interview again and select your full screen.",
        });
        return;
      }

      await startInterviewFlow();
    } catch (error) {
      log.error(LOG_CATEGORY, "[interview] Start failed:", error);
      setIsStarting(false);
      setPreInterviewNotice({
        title: "Microphone access is required",
        description: "Please allow microphone access and click Start Interview again.",
      });
    }
  };

  // STAGE 3: Start interview flow
  const startInterviewFlow = async () => {
    try {
      const firstName = name.trim().split(" ")[0];
      dispatch(start({ candidateName: firstName }));
      dispatch(setStage({ stage: "background" }));

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

      setIsArriving(true);
      setShowAnnouncement(true);
    } catch (error) {
      log.error(LOG_CATEGORY, "[interview] Start flow failed:", error);
    }
  };

  // Announcement complete handler
  const handleAnnouncementComplete = useCallback(() => {
    log.info(LOG_CATEGORY, "[interview] Announcement complete");
    setShowAnnouncement(false);
    setIsArriving(false); // Atomic transition - no setTimeout
    setAllowQuestionDisplay(true);
    const firstQuestion = preloadedFirstQuestion || "";
    dispatch(startTimer());
    setCurrentQuestion(firstQuestion);
    dispatch(addMessage({ text: firstQuestion, speaker: "ai" }));

    // Set pending intent for first question (from preload)
    if (preloadedFirstIntent) {
      setPendingIntent(preloadedFirstIntent);
    }

    // Save first question to DB
    if (interviewSessionId) {
      fetch(`/api/interviews/session/${interviewSessionId}/messages?skip-auth=true`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId, // Required for skip-auth
          messages: [{
            text: firstQuestion,
            speaker: "ai",
            stage: "background",
            timestamp: new Date().toISOString()
          }]
        })
      }).catch(err => log.error(LOG_CATEGORY, "[interview] Failed to save first question:", err));
    }
  }, [preloadedFirstQuestion, preloadedFirstIntent, dispatch, interviewSessionId, userId]);

  // Answer submission handler
  const handleSubmitAnswer = async (answer: string) => {
    setSubmitting(true);

    try {
      setIsFirstQuestion(false);
      const result = await submitAnswer(answer, name);

      if (result.shouldComplete) {
        setCompleted(true);
      } else {
        setSubmitting(false);
      }
    } catch (error) {
      log.error(LOG_CATEGORY, "[interview] Answer submit failed:", error);
    } finally {
      setSubmitting(false);
    }
  };

  // Glow state handlers
  const handleAudioStateChange = useCallback((isPlaying: boolean, intentText?: string, visemes?: import("@/shared/types/mascot").Viseme[]) => {
    setIsAIAudioPlaying(isPlaying);
    if (isPlaying && visemes) {
      setCurrentVisemes(visemes);
    } else if (!isPlaying) {
      // Clear visemes when audio stops to prevent continued animation
      setCurrentVisemes([]);
    }
    if (isPlaying) {
      // Clear intent when audio starts
      setCurrentIntent("");
    } else if (intentText) {
      // Set intent when audio finishes
      setCurrentIntent(intentText);
    }
  }, []);

  const handleRecordingStateChange = useCallback((isRecording: boolean) => {
    setIsUserRecording(isRecording);
  }, []);

  // Auto-transition when timer expires
  useEffect(() => {
    if (stage !== "background") return;
    if (completed || submitting) return;

    const checkTimer = () => {
      const backgroundState = store.getState().background;
      const { startedAtMs, timeboxMs } = backgroundState;
      
      if (!startedAtMs) return;
      
      const limit = timeboxMs || (backgroundTimeSeconds ? backgroundTimeSeconds * 1000 : 7000);
      const elapsed = Date.now() - startedAtMs;
      
      if (elapsed >= limit) {
        log.info(LOG_CATEGORY, "[interview] Timer expired - auto-completing background stage");
        setCompleted(true);
      }
    };

    const interval = setInterval(checkTimer, 1000);
    return () => clearInterval(interval);
  }, [stage, completed, submitting, backgroundTimeSeconds]);

  useEffect(() => {
    if (stage !== "background" || !backgroundStartedAtMs) return;

    const interval = setInterval(() => {
      setBackgroundNowMs(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [stage, backgroundStartedAtMs]);

  const effectiveBackgroundTimeboxMs = backgroundTimeboxMs || (backgroundTimeSeconds ? backgroundTimeSeconds * 1000 : 7000);
  const backgroundElapsedMs = backgroundStartedAtMs ? Math.max(0, backgroundNowMs - backgroundStartedAtMs) : 0;
  const backgroundRemainingMs = Math.max(0, effectiveBackgroundTimeboxMs - backgroundElapsedMs);
  const shouldShowBackgroundCountdown =
    stage === "background" &&
    Boolean(backgroundStartedAtMs) &&
    !completed &&
    backgroundRemainingMs > 0 &&
    backgroundRemainingMs <= 60000;
  const isUrgentCountdown = backgroundRemainingMs <= 10000;
  const backgroundRemainingSeconds = Math.ceil(backgroundRemainingMs / 1000);
  const backgroundMinutes = Math.floor(backgroundRemainingSeconds / 60);
  const backgroundSeconds = backgroundRemainingSeconds % 60;
  const backgroundCountdownLabel = `${backgroundMinutes}:${String(backgroundSeconds).padStart(2, "0")}`;

  // Start coding handler
  const handleStartCoding = () => {
    if (!companyId || !currentJobId) {
      throw new Error("Interview context is missing companyId or jobId");
    }
    dispatch(setStage({ stage: "coding" }));
    setShowCodingIDE(true);
  };

  // ===== RENDER CONDITIONS =====
  
  // Unified camera visibility control - single source of truth
  const showCamera = !showAnnouncement && currentQuestion !== "";
  const isDebugModeEnabled = process.env.NEXT_PUBLIC_DEBUG_MODE === "true";

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  const role = (session?.user as any)?.role;
  const settingsPath = role === "COMPANY" ? "/company-dashboard/settings" : "/settings";

  if (isPreloading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white flex items-center justify-center p-4">
        <SfinxSpinner size="lg" title="Loading interview" messages="Setting things up" />
      </div>
    );
  }

  if (entryError) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white flex items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-3xl border border-red-100 bg-white/90 shadow-xl p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M4.93 19h14.14c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.2 16c-.77 1.33.19 3 1.73 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">{entryError.title}</h1>
          <p className="mt-3 text-sm leading-6 text-gray-600">{entryError.description}</p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link
              href="/job-search"
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Back to jobs
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (showPreInterviewScreen && backgroundTimeSeconds) {
    const backgroundTimeMinutes = Math.round(backgroundTimeSeconds / 60);
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white flex flex-col">
        {/* Interview Header */}
        <header className="animate-slide-down border-b border-gray-200/30 bg-white/95 backdrop-blur-2xl px-6 py-4">
          <div className="flex items-center justify-between max-w-8xl mx-auto">
            {/* Left: Sfinx Logo (clickable to exit) */}
            <Link href="/job-search" className="flex items-center cursor-pointer">
              <SfinxLogo width={100} height={32} className="w-[100px] h-auto" />
            </Link>

            {/* Right: Avatar Menu */}
            <div className="flex items-center gap-4">
              {/* Mute Button */}
              <button
                onClick={toggleMute}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? (
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipRule="evenodd" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                )}
              </button>

              {session?.user && (
                <Menu as="div" className="relative">
                  <Menu.Button className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center overflow-hidden relative cursor-pointer">
                    {session.user.image ? (
                      <Image
                        key={session.user.image}
                        src={session.user.image}
                        alt="Profile"
                        fill
                        sizes="40px"
                        className="object-cover rounded-full"
                      />
                    ) : (
                      <span className="text-xs font-medium text-gray-700">
                        {(session.user as any).name?.charAt(0)?.toUpperCase() ||
                          (session.user as any).email?.charAt(0)?.toUpperCase()}
                      </span>
                    )}
                  </Menu.Button>
                  <Menu.Items className="absolute right-0 mt-3 origin-top-right rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 focus:outline-none w-64 z-50 overflow-hidden backdrop-blur-xl">
                    {/* User Info Section */}
                    <div className="px-4 py-4 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center overflow-hidden relative">
                          {session.user.image ? (
                            <Image
                              src={session.user.image}
                              alt="Profile"
                              fill
                              sizes="40px"
                              className="object-cover"
                            />
                          ) : (
                            <span className="text-sm font-semibold text-white">
                              {(session.user as any).name?.charAt(0)?.toUpperCase() ||
                                (session.user as any).email?.charAt(0)?.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {(session.user as any).name || "User"}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {(session.user as any).email}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Menu Items */}
                    <div className="py-2">
                      <Menu.Item>
                        {({ active }) => (
                          <Link
                            href={settingsPath}
                            className={`${
                              active ? "bg-gray-50" : ""
                            } group flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 transition-all duration-150 ease-out`}
                          >
                            <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span>Settings</span>
                          </Link>
                        )}
                      </Menu.Item>

                      <Menu.Item>
                        {({ active }) => (
                          <button
                            onClick={handleSignOut}
                            className={`${
                              active ? "bg-gray-50" : ""
                            } group flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 transition-all duration-150 ease-out w-full cursor-pointer`}
                          >
                            <svg className="w-5 h-5 text-gray-400 group-hover:text-red-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            <span className="group-hover:text-red-600 transition-colors">Sign out</span>
                          </button>
                        )}
                      </Menu.Item>
                    </div>
                  </Menu.Items>
                </Menu>
              )}
            </div>
          </div>
        </header>

        {/* Pre-Interview Screen Content */}
        <PreInterviewScreen
          onStartInterview={handleStartInterviewClick}
          backgroundTimeMinutes={backgroundTimeMinutes}
          notice={preInterviewNotice}
          loading={isStarting}
        />
      </div>
    );
  }

  if (isStarting) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white flex items-center justify-center p-4">
        <SfinxSpinner size="lg" title="Starting interview" messages="Requesting permissions" />
      </div>
    );
  }

  if (skipToCoding && isStarting) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white flex items-center justify-center p-4">
        <SfinxSpinner size="lg" title="Starting coding session" messages="Preparing your interview" />
      </div>
    );
  }

  if (stage === "coding" && showCodingIDE) {
    return (
      <InterviewRecordingProvider value={recordingControls}>
        <InterviewIDE micStream={micStream} />
      </InterviewRecordingProvider>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white flex flex-col relative">
        {/* Interview Header */}
        <header className="border-b border-gray-200/30 bg-white/95 backdrop-blur-2xl px-6 py-4">
          <div className="flex items-center justify-between max-w-8xl mx-auto">
            {/* Left: Sfinx Logo (clickable to exit) */}
            <Link href="/job-search" className="flex items-center cursor-pointer">
              <SfinxLogo width={100} height={32} className="w-[100px] h-auto" />
            </Link>

            {/* Right: Avatar Menu */}
            <div className="flex items-center gap-4">
              {session?.user && (
                <Menu as="div" className="relative">
                  <Menu.Button className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center overflow-hidden relative cursor-pointer">
                    {session.user.image ? (
                      <Image
                        key={session.user.image}
                        src={session.user.image}
                        alt="Profile"
                        fill
                        sizes="40px"
                        className="object-cover rounded-full"
                      />
                    ) : (
                      <span className="text-xs font-medium text-gray-700">
                        {(session.user as any).name?.charAt(0)?.toUpperCase() ||
                          (session.user as any).email?.charAt(0)?.toUpperCase()}
                      </span>
                    )}
                  </Menu.Button>
                  <Menu.Items className="absolute right-0 mt-3 origin-top-right rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 focus:outline-none w-64 z-50 overflow-hidden backdrop-blur-xl">
                    {/* User Info Section */}
                    <div className="px-4 py-4 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center overflow-hidden relative">
                          {session.user.image ? (
                            <Image
                              src={session.user.image}
                              alt="Profile"
                              fill
                              sizes="40px"
                              className="object-cover"
                            />
                          ) : (
                            <span className="text-sm font-semibold text-white">
                              {(session.user as any).name?.charAt(0)?.toUpperCase() ||
                                (session.user as any).email?.charAt(0)?.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {(session.user as any).name || "User"}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {(session.user as any).email}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Menu Items */}
                    <div className="py-2">
                      <Menu.Item>
                        {({ active }) => (
                          <Link
                            href={settingsPath}
                            className={`${
                              active ? "bg-gray-50" : ""
                            } group flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 transition-all duration-150 ease-out`}
                          >
                            <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span>Settings</span>
                          </Link>
                        )}
                      </Menu.Item>

                      <Menu.Item>
                        {({ active }) => (
                          <button
                            onClick={handleSignOut}
                            className={`${
                              active ? "bg-gray-50" : ""
                            } group flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 transition-all duration-150 ease-out w-full cursor-pointer`}
                          >
                            <svg className="w-5 h-5 text-gray-400 group-hover:text-red-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            <span className="group-hover:text-red-600 transition-colors">Sign out</span>
                          </button>
                        )}
                      </Menu.Item>
                    </div>
                  </Menu.Items>
                </Menu>
              )}
            </div>
          </div>
        </header>

        {/* Completion Screen Content */}
        <div data-testid="background-complete" data-session-id={interviewSessionId ?? ""} className="flex-1 flex items-center justify-center p-4">
          <CompletionScreen
            onStartCoding={handleStartCoding}
            interviewSessionId={interviewSessionId}
            userId={userId || undefined}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white flex flex-col relative">
      {/* Interview Header */}
      {!isPreloading && stage === "background" && (
        <header className="border-b border-gray-200/30 bg-white/95 backdrop-blur-2xl px-6 py-4">
          <div className="flex items-center justify-between max-w-8xl mx-auto">
            {/* Left: Sfinx Logo (clickable to exit) */}
            <Link href="/job-search" className="flex items-center cursor-pointer">
              <SfinxLogo width={100} height={32} className="w-[100px] h-auto" />
            </Link>

            {/* Right: Controls and Avatar */}
            <div className="flex items-center gap-4">
              {/* Debug Toggle Button */}
              {isDebugModeEnabled && showDebugButton && (
                <button
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('toggleDebugPanel'));
                  }}
                  className={`w-10 h-10 rounded-full border-2 border-sfinx-purple transition-all flex items-center justify-center ${
                    isDebugVisible ? 'bg-sfinx-purple text-white' : 'text-sfinx-purple hover:bg-sfinx-purple hover:text-white'
                  }`}
                  title="Toggle Debug Panel"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                </button>
              )}

              {/* Mute Button */}
              <button
                onClick={toggleMute}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? (
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipRule="evenodd" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                )}
              </button>

              {/* Avatar Menu */}
              {session?.user && (
                <Menu as="div" className="relative">
                  <Menu.Button className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center overflow-hidden relative cursor-pointer">
                    {session.user.image ? (
                      <Image
                        key={session.user.image}
                        src={session.user.image}
                        alt="Profile"
                        fill
                        sizes="40px"
                        className="object-cover rounded-full"
                      />
                    ) : (
                      <span className="text-xs font-medium text-gray-700">
                        {(session.user as any).name?.charAt(0)?.toUpperCase() ||
                          (session.user as any).email?.charAt(0)?.toUpperCase()}
                      </span>
                    )}
                  </Menu.Button>
                  <Menu.Items className="absolute right-0 mt-3 origin-top-right rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 focus:outline-none w-64 z-50 overflow-hidden backdrop-blur-xl">
                    {/* User Info Section */}
                    <div className="px-4 py-4 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center overflow-hidden relative">
                          {session.user.image ? (
                            <Image
                              src={session.user.image}
                              alt="Profile"
                              fill
                              sizes="40px"
                              className="object-cover"
                            />
                          ) : (
                            <span className="text-sm font-semibold text-white">
                              {(session.user as any).name?.charAt(0)?.toUpperCase() ||
                                (session.user as any).email?.charAt(0)?.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {(session.user as any).name || "User"}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {(session.user as any).email}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Menu Items */}
                    <div className="py-2">
                      <Menu.Item>
                        {({ active }) => (
                          <Link
                            href={settingsPath}
                            className={`${
                              active ? "bg-gray-50" : ""
                            } group flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 transition-all duration-150 ease-out`}
                          >
                            <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span>Settings</span>
                          </Link>
                        )}
                      </Menu.Item>

                      <Menu.Item>
                        {({ active }) => (
                          <button
                            onClick={handleSignOut}
                            className={`${
                              active ? "bg-gray-50" : ""
                            } group flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 transition-all duration-150 ease-out w-full cursor-pointer`}
                          >
                            <svg className="w-5 h-5 text-gray-400 group-hover:text-red-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            <span className="group-hover:text-red-600 transition-colors">Sign out</span>
                          </button>
                        )}
                      </Menu.Item>
                    </div>
                  </Menu.Items>
                </Menu>
              )}
            </div>
          </div>
        </header>
      )}

      {/* Breadcrumbs */}
      {!isPreloading && stage !== "coding" && (
        <div className="pt-8 px-6">
          <Breadcrumbs items={breadcrumbTrail} />
        </div>
      )}

      {shouldShowBackgroundCountdown && (
        <div className="absolute top-6 right-6 z-30 pointer-events-none">
          <div
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold font-mono shadow-sm backdrop-blur-sm transition-colors duration-300 ${
              isUrgentCountdown
                ? "bg-red-50/90 border-red-200 text-red-700"
                : "bg-violet-50/90 border-violet-200 text-violet-700"
            }`}
            aria-live="polite"
            role="status"
          >
            {backgroundCountdownLabel}
          </div>
        </div>
      )}
      
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl flex flex-col items-center gap-4">
          {/* AI Interviewer and Camera - side by side above question card */}
          <div className={`flex gap-8 mb-6 justify-center items-center transition-opacity duration-500 ${
            (currentQuestion && !showAnnouncement) || isArriving ? 'opacity-100' : 'opacity-0'
          }`}>
            {/* AI Interviewer Box Wrapper - animates position with transform */}
            <div className={`w-[350px] transition-all duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
              isArriving ? 'translate-x-0 scale-110' : 'translate-x-0 scale-100'
            }`}>
              <AIInterviewerBox 
                isActive={!isPreloading && stage === "background"} 
                hasGlow={isAIAudioPlaying}
                mode={isAIAudioPlaying ? "talking" : "idle"}
                intent={currentIntent}
                isArriving={isArriving}
                visemes={currentVisemes}
              />
            </div>
            
            {/* Camera Preview Wrapper - layered for glow, unified visibility */}
            <div className={`relative transition-all duration-[600ms] ease-out ${
              showCamera ? 'opacity-100 w-[350px] visible' : 'opacity-0 w-0 invisible'
            }`}>
              {/* Outer glow layer - soft shadow with fade-in */}
              <div className={`absolute inset-0 rounded-xl shadow-[0_0_25px_rgba(168,85,247,0.5)] pointer-events-none transition-opacity duration-500 ${
                showCamera && (showCameraGlow || isUserRecording) ? 'opacity-100' : 'opacity-0'
              }`} />
              
              {/* Inner camera layer */}
              <CameraPreview
                isCameraOn={isCameraOn}
                videoRef={selfVideoRef}
                hasGlow={false}
              />
            </div>
          </div>
          
          {/* Announcement text - animates height to prevent vertical collapse */}
          <div 
            className="announcement-wrapper w-full max-w-4xl px-8"
            data-show={isArriving && showAnnouncement}
          >
            {(isArriving && showAnnouncement) && (
              <AnnouncementScreen
                key={announcementText}
                text={announcementText}
                preloadedAudioBlob={announcementAudioBlob}
                onComplete={handleAnnouncementComplete}
                onAudioStateChange={handleAudioStateChange}
              />
            )}
          </div>
          
          {/* Question content */}
          <div className="mx-auto">
            {!showAnnouncement && (
              <QuestionCard
                question={currentQuestion}
                onSubmitAnswer={handleSubmitAnswer}
                loading={submitting}
                micStream={micStream}
                isFirstQuestion={isFirstQuestion}
                interviewSessionId={interviewSessionId}
                getActualRecordingStartTime={getActualRecordingStartTime}
                questionNumber={backgroundQuestionNumber}
                userId={userId || undefined}
                onAudioStateChange={handleAudioStateChange}
                onRecordingStateChange={handleRecordingStateChange}
                intentText={pendingIntent}
              />
            )}
          </div>
        </div>
      </div>

      {/* Debug Panel - below content in document flow, scroll down to see it */}
      {isDebugVisible && isDebugModeEnabled && !showCodingIDE && (
        <div className="w-full p-4 max-w-6xl mx-auto">
          <BackgroundDebugPanel 
            timeboxMs={backgroundTimeSeconds ? backgroundTimeSeconds * 1000 : undefined}
            experienceCategories={experienceCategories}
            realtimeEvaluations={backgroundEvaluations}
          />
        </div>
      )}
    </div>
  );
}

export default function InterviewPage() {
  return (
    <AuthGuard requiredRole="CANDIDATE">
      <Suspense fallback={<div>Loading...</div>}>
        <InterviewPageContent />
      </Suspense>
    </AuthGuard>
  );
}
