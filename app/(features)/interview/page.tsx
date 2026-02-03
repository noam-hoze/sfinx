"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useSession } from "next-auth/react";
import { log } from "app/shared/services/logger";
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
import Breadcrumbs from "app/shared/components/Breadcrumbs";
import InterviewStageScreen from "app/shared/components/InterviewStageScreen";
import { InterviewIDE } from "./components";
import CameraPreview from "./components/CameraPreview";
import AIInterviewerBox from "./components/AIInterviewerBox";
import { useMute } from "app/shared/contexts";
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
  useSoundPreload,
  useBackgroundAnswerHandler,
} from "@/shared/services/backgroundInterview";

/**
 * Interview Page - Unified flow: Background Q&A → Completion → Coding IDE.
 * All stages on single page with Redux state machine driving UI.
 */
const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEWS;

function InterviewPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isMuted } = useMute();
  const { isDebugVisible, setShowDebugButton } = useDebug();
  const dispatch = useDispatch();
  const { data: session, status: sessionStatus } = useSession();

  // Local loading state for preload phase
  const [isPreloading, setIsPreloading] = useState(true);
  const [showPreInterviewScreen, setShowPreInterviewScreen] = useState(false);
  
  // Redux state
  const stage = useSelector((state: RootState) => state.interview.stage);
  const { isCameraOn, selfVideoRef } = useCamera();
  const companyName = useSelector((state: RootState) => state.interview.companyName);
  const companySlug = useSelector((state: RootState) => state.interview.companySlug);
  const roleSlug = useSelector((state: RootState) => state.interview.roleSlug);
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
  const [openaiClient, setOpenaiClient] = useState<OpenAI | null>(null);
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

  const skipToCoding = process.env.NEXT_PUBLIC_SKIP_TO_CODING === "true";
  const skipScreenShare = process.env.NEXT_PUBLIC_SKIP_SCREEN_SHARE === "true";
  const recordingControls = useScreenRecording();
  const { startRecording, interviewSessionId, setInterviewSessionId, getActualRecordingStartTime } = recordingControls;

  // Build breadcrumb trail
  const jobTitle = roleSlug?.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") || "";
  const breadcrumbTrail = getBreadcrumbTrail("/interview", "CANDIDATE", {
    companyName: companyName ?? "",
    jobTitle: jobTitle
  });

  // Refs
  const clickSoundRef = useRef<HTMLAudioElement | null>(null);
  const startSoundRef = useRef<HTMLAudioElement | null>(null);
  const interviewSessionIdRef = useRef<string | null>(null);
  const completedRef = useRef<boolean>(false);
  const hasAutoStartedRef = useRef<boolean>(false);
  const hasPreloadedRef = useRef<boolean>(false);

  // Extracted services
  const { preload } = useBackgroundPreload();
  const { generateAnnouncement } = useAnnouncementGeneration();
  const { clickSoundRef: refClickSound, startSoundRef: refStartSound, soundsReady } = useSoundPreload();
  const { handleSubmit: submitAnswer } = useBackgroundAnswerHandler(
    (evalData) => {
      setBackgroundEvaluations(prev => [...prev, evalData]);
    },
    (intent) => {
      setPendingIntent(intent);
    }
  );

  // Sync service sound refs to local refs
  useEffect(() => {
    clickSoundRef.current = refClickSound.current;
    startSoundRef.current = refStartSound.current;
  }, [refClickSound, refStartSound]);

  // Cleanup on unmount - reset all interview state when leaving the flow
  useEffect(() => {
    setShowDebugButton(true);
    return () => {
      log.info(LOG_CATEGORY, "[interview] Component unmounting - cleaning up state");
      dispatch(resetInterview());
      setShowDebugButton(false);
    };
  }, [dispatch, setShowDebugButton]);

  // Initialize OpenAI client
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    if (apiKey) {
      setOpenaiClient(new OpenAI({ apiKey, dangerouslyAllowBrowser: true }));
    }
  }, []);

  // Skip preload if going directly to coding
  useEffect(() => {
    if (skipToCoding && isPreloading) {
      log.info(LOG_CATEGORY, "[interview] Skip-to-coding mode: bypassing preload");
      
      const setupUserId = async () => {
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
  }, [skipToCoding, isPreloading, session, dispatch, companySlug, roleSlug]);

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
      hasAutoStartedRef.current = false;
      hasPreloadedRef.current = false;
    }
  }, [shouldResetFlag, dispatch, applicationId, setInterviewSessionId]);

  // STAGE 1: Preload (skip if going directly to coding)
  useEffect(() => {
    if (!openaiClient || skipToCoding || hasPreloadedRef.current || sessionStatus !== "authenticated") return;

    const executePreload = async () => {
      try {
        setIsPreloading(true);
        hasPreloadedRef.current = true;
        
        const urlCompanyId = searchParams.get("companyId");
        const urlJobId = searchParams.get("jobId");
        
        if (!urlCompanyId || !urlJobId) {
          throw new Error("Missing required URL parameters: companyId and jobId");
        }
        
        const roleSlugFromUrl = urlJobId.replace(`${urlCompanyId}-`, "");
        
        // Pass session userId for authenticated users
        const sessionUserId = (session?.user as any)?.id;
        await preload(urlJobId, urlCompanyId, openaiClient, sessionUserId, setBackgroundTimeSeconds, setExperienceCategories);

        // Generate announcement
        const jobTitle = roleSlugFromUrl.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        const { text, audioBlob } = await generateAnnouncement(jobTitle);
        setAnnouncementText(text);
        setAnnouncementAudioBlob(audioBlob);

        log.info(LOG_CATEGORY, "[interview] Preload complete - moving to welcome");
        setIsPreloading(false);
        setShowPreInterviewScreen(true);
      } catch (error) {
        log.error(LOG_CATEGORY, "[interview] Preload failed:", error);
        setIsPreloading(false);
        alert("Failed to initialize interview. Please refresh and try again.");
      }
    };

    executePreload();
  }, [openaiClient, skipToCoding, preload, generateAnnouncement, session, searchParams, sessionStatus]);

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
      if (!companySlug || !roleSlug) {
        throw new Error("Company and role not initialized from URL");
      }
      const jobId = `${companySlug}-${roleSlug}`;
      const companyId = companySlug;
      const application = await createApplication({
        companyId,
        jobId,
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
  }, [codingApplicationId, applicationId, companySlug, roleSlug, userId, dispatch]);

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
      // Start recording before syncing
      const recordingStarted = await startRecording();
      if (!recordingStarted) return null;
      
      // Sync Redux → local state
      setInterviewSessionId(reduxSessionId);
      return reduxSessionId;
    }

    // No existing session - create a new one
    try {
      const recordingStarted = await startRecording();
      if (!recordingStarted) return null;

      const resolvedApplicationId = await resolveApplicationId();
      if (!resolvedApplicationId) return null;

      if (!companySlug) {
        throw new Error("companySlug is required to create interview session");
      }
      const session = await createInterviewSession({
        applicationId: resolvedApplicationId,
        companyId: companySlug,
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
    companySlug,
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
        alert("Screen recording is required.");
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
      alert("Microphone access is required.");
    }
  }, [isStarting, showAnnouncement, stage, session, ensureRecordingSession, dispatch, isMuted]);

  // Auto-start interview for authenticated users after preload
  useEffect(() => {
    // CRITICAL: Skip this effect - recording/mic now triggered by PreInterviewScreen button
    return;
  }, []);

  // Auto-skip to coding when flag is set and user is logged in
  useEffect(() => {
    log.info(LOG_CATEGORY, "[interview] Auto-skip check:", { skipToCoding, userId, showCodingIDE, isStarting, isPreloading, skipScreenShare });
    
    if (!skipToCoding || !userId || showCodingIDE || isStarting || isPreloading || !companySlug || !roleSlug) return;

    const initializeCodingSession = async () => {
      try {
        setIsStarting(true);
        log.info(LOG_CATEGORY, "[interview] Skip-to-coding mode: initializing");

        let activeSessionId = null;
        
        if (skipScreenShare) {
          // Skip recording entirely - just create session without recording
          log.info(LOG_CATEGORY, "[interview] Skipping screen recording (NEXT_PUBLIC_SKIP_SCREEN_SHARE=true)");
          const resolvedApplicationId = await resolveApplicationId();
          if (resolvedApplicationId) {
            if (!companySlug) {
              throw new Error("Company slug not initialized from URL");
            }
            const session = await createInterviewSession({
              applicationId: resolvedApplicationId,
              companyId: companySlug,
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
            log.error(LOG_CATEGORY, "[interview] Recording required for skip-to-coding");
            alert("Screen recording is required to start the interview.");
            setIsStarting(false);
            return;
          }
        }

        if (!companySlug || !roleSlug) {
          throw new Error("Company and role not initialized from URL");
        }
        if (!companyName) {
          throw new Error("companyName is required to start coding session");
        }
        dispatch(setCompanyContext({
          companyName,
          companySlug,
          roleSlug,
        }));
        dispatch(setStage({ stage: "coding" }));
        setShowCodingIDE(true);
        setIsStarting(false);
        log.info(LOG_CATEGORY, "[interview] Skip-to-coding complete");
      } catch (error) {
        log.error(LOG_CATEGORY, "[interview] Skip-to-coding failed:", error);
        setIsStarting(false);
        alert("Failed to start coding session. Please refresh and try again.");
      }
    };

    initializeCodingSession();
  }, [skipToCoding, userId, showCodingIDE, isStarting, isPreloading, skipScreenShare, ensureRecordingSession, resolveApplicationId, setInterviewSessionId, dispatch, companyName, companySlug, roleSlug]);

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
        alert("Screen recording is required.");
        return;
      }

      await startInterviewFlow();
    } catch (error) {
      log.error(LOG_CATEGORY, "[interview] Start failed:", error);
      setIsStarting(false);
      alert("Microphone access is required.");
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
      log.error(LOG_CATEGORY, "[interview] Answer submit failed:", error);
    } finally {
      setSubmitting(false);
    }
  };

  // Glow state handlers
  const handleAudioStateChange = useCallback((isPlaying: boolean, intentText?: string, visemes?: import("@/shared/types/mascot").Viseme[]) => {
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/a7a962d3-a365-4cdf-9479-10209a61a26e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:handleAudioStateChange',message:'Audio state change',data:{isPlaying,hasVisemes:!!visemes,visemesCount:visemes?.length,intentText},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    setIsAIAudioPlaying(isPlaying);
    if (isPlaying && visemes) {
      setCurrentVisemes(visemes);
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/a7a962d3-a365-4cdf-9479-10209a61a26e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:setVisemes',message:'Setting visemes',data:{count:visemes.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
    } else if (!isPlaying) {
      // Clear visemes when audio stops to prevent continued animation
      setCurrentVisemes([]);
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/a7a962d3-a365-4cdf-9479-10209a61a26e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:clearVisemes',message:'Clearing visemes',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
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

  // Start coding handler
  const handleStartCoding = () => {
    if (!companySlug || !roleSlug) {
      throw new Error("Company and role not initialized from URL");
    }
    if (!companyName) {
      throw new Error("companyName is required to start coding");
    }
    dispatch(setStage({ stage: "coding" }));
    setShowCodingIDE(true);
  };

  // ===== RENDER CONDITIONS =====
  
  // Unified camera visibility control - single source of truth
  const showCamera = !showAnnouncement && currentQuestion !== "";

  if (isPreloading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white flex items-center justify-center p-4">
        <SfinxSpinner size="lg" title="Loading interview" messages="Setting things up" />
      </div>
    );
  }

  if (showPreInterviewScreen && backgroundTimeSeconds) {
    const backgroundTimeMinutes = Math.round(backgroundTimeSeconds / 60);
    return (
      <PreInterviewScreen
        onStartInterview={handleStartInterviewClick}
        backgroundTimeMinutes={backgroundTimeMinutes}
      />
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
        <InterviewIDE />
      </InterviewRecordingProvider>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white flex flex-col relative">
        <div className="flex-1 flex items-center justify-center p-4">
          <CompletionScreen
            onStartCoding={handleStartCoding}
            interviewSessionId={interviewSessionId}
            userId={userId || undefined}
          />
        </div>
      </div>
    );
  }

  const isDebugModeEnabled = process.env.NEXT_PUBLIC_DEBUG_MODE === "true";

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white flex flex-col relative">

      {/* Breadcrumbs */}
      {!isPreloading && stage !== "coding" && (
        <div className="pt-8 px-6">
          <Breadcrumbs items={breadcrumbTrail} />
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
    <Suspense fallback={<div>Loading...</div>}>
      <InterviewPageContent />
    </Suspense>
  );
}
