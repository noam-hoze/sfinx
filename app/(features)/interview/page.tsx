"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useSession } from "next-auth/react";
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
import SfinxSpinner from "app/shared/components/SfinxSpinner";
import Breadcrumbs from "app/shared/components/Breadcrumbs";
import InterviewStageScreen from "app/shared/components/InterviewStageScreen";
import { InterviewIDE } from "./components";
import { useMute } from "app/shared/contexts";
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
function InterviewPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isMuted } = useMute();
  const { isDebugVisible } = useDebug();
  const dispatch = useDispatch();
  const { data: session } = useSession();

  // Local loading state for preload phase
  const [isPreloading, setIsPreloading] = useState(true);
  
  // Redux state
  const stage = useSelector((state: RootState) => state.interview.stage);
  const companyName = useSelector((state: RootState) => state.interview.companyName);
  const companySlug = useSelector((state: RootState) => state.interview.companySlug);
  const roleSlug = useSelector((state: RootState) => state.interview.roleSlug);
  const preloadedFirstQuestion = useSelector((state: RootState) => state.interview.preloadedFirstQuestion);
  const userId = useSelector((state: RootState) => state.interview.userId);
  const applicationId = useSelector((state: RootState) => state.interview.applicationId);
  const shouldResetFlag = useSelector((state: RootState) => state.interview.shouldReset);
  const reduxSessionId = useSelector((state: RootState) => state.interview.sessionId);

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
  const { handleSubmit: submitAnswer } = useBackgroundAnswerHandler((evalData) => {
    setBackgroundEvaluations(prev => [...prev, evalData]);
  });

  // Sync service sound refs to local refs
  useEffect(() => {
    clickSoundRef.current = refClickSound.current;
    startSoundRef.current = refStartSound.current;
  }, [refClickSound, refStartSound]);

  // Cleanup on unmount - reset all interview state when leaving the flow
  useEffect(() => {
    return () => {
      console.log("[interview] Component unmounting - cleaning up state");
      dispatch(resetInterview());
    };
  }, [dispatch]);

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
      console.log("[interview] Skip-to-coding mode: bypassing preload");
      
      const setupUserId = async () => {
        // Try to use session userId first
        const sessionUserId = (session?.user as any)?.id;
        if (sessionUserId) {
          dispatch(setPreloadedData({ userId: sessionUserId }));
          console.log("[interview] Set userId from session:", sessionUserId);
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
  }, [allowQuestionDisplay, currentQuestion, messages]);

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
        console.log("[interview] Mic stream stopped on cleanup");
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
        console.log("[interview] Skipping cleanup - sessionId:", sessionId, "completed:", isCompleted);
        return;
      }

      console.log("[interview] Component unmounting - terminating session:", sessionId);

      // Stop recording
      try {
        recordingControls.stopRecording();
      } catch (error) {
        console.error("[interview] Error stopping recording:", error);
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
        console.error("[interview] Error terminating session:", error);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup on page close/refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!interviewSessionId || completed) return;

      console.log("[interview] Page closing - terminating session");

      // Stop recording synchronously
      try {
        recordingControls.stopRecording();
      } catch (error) {
        console.error("[interview] Error stopping recording:", error);
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
      console.log("[interview] Reset triggered");
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
    if (!openaiClient || skipToCoding || hasPreloadedRef.current) return;

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

        console.log("[interview] Preload complete - moving to welcome");
        setIsPreloading(false);
      } catch (error) {
        console.error("[interview] Preload failed:", error);
        setIsPreloading(false);
        alert("Failed to initialize interview. Please refresh and try again.");
      }
    };

    executePreload();
  }, [openaiClient, skipToCoding, preload, generateAnnouncement, session, searchParams]);

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
      console.error("[interview] Failed to create application:", error);
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
      console.error("[interview] Failed to create recording session:", error);
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

  // Auto-start interview for authenticated users after preload
  useEffect(() => {
    // CRITICAL: Wait for preload to finish (it sets reduxSessionId)
    if (isPreloading || skipToCoding || isStarting || showAnnouncement || stage !== null || hasAutoStartedRef.current || !reduxSessionId) {
      return;
    }

    const autoStartAuthenticated = async () => {
      try {
        hasAutoStartedRef.current = true;
        setIsStarting(true);
        console.log("[interview] Auto-starting interview for authenticated user");

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

        setShowAnnouncement(true);
        setIsStarting(false);
      } catch (error) {
        console.error("[interview] Auto-start failed:", error);
        setIsStarting(false);
        alert("Microphone access is required.");
      }
    };

    autoStartAuthenticated();
  }, [isPreloading, skipToCoding, isStarting, showAnnouncement, stage, reduxSessionId, session, ensureRecordingSession, dispatch, isMuted]);

  // Auto-skip to coding when flag is set and user is logged in
  useEffect(() => {
    console.log("[interview] Auto-skip check:", { skipToCoding, userId, showCodingIDE, isStarting, isPreloading, skipScreenShare });
    
    if (!skipToCoding || !userId || showCodingIDE || isStarting || isPreloading || !companySlug || !roleSlug) return;

    const initializeCodingSession = async () => {
      try {
        setIsStarting(true);
        console.log("[interview] Skip-to-coding mode: initializing");

        let activeSessionId = null;
        
        if (skipScreenShare) {
          // Skip recording entirely - just create session without recording
          console.log("[interview] Skipping screen recording (NEXT_PUBLIC_SKIP_SCREEN_SHARE=true)");
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
            console.error("[interview] Recording required for skip-to-coding");
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
        console.log("[interview] Skip-to-coding complete");
      } catch (error) {
        console.error("[interview] Skip-to-coding failed:", error);
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
    dispatch(startTimer());
    setCurrentQuestion(firstQuestion);
    dispatch(addMessage({ text: firstQuestion, speaker: "ai" }));

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
      }).catch(err => console.error("[interview] Failed to save first question:", err));
    }
  }, [preloadedFirstQuestion, dispatch, interviewSessionId, userId]);

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
        console.log("[interview] Timer expired - auto-completing background stage");
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

  if (isPreloading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white flex items-center justify-center p-4">
        <SfinxSpinner size="lg" title="Loading interview" messages="Setting things up" />
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
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white flex flex-col">
      {/* Breadcrumbs */}
      {!isPreloading && stage !== "coding" && (
        <div className="pt-8 px-6">
          <Breadcrumbs items={breadcrumbTrail} />
        </div>
      )}
      
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
            interviewSessionId={interviewSessionId}
            getActualRecordingStartTime={getActualRecordingStartTime}
            questionNumber={backgroundQuestionNumber}
            userId={userId || undefined}
          />
        )}
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
