"use client";

import { log } from "app/shared/services/logger";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";

const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEW_UI;

import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import Image from "next/image";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Menu } from "@headlessui/react";
import EditorPanel from "./editor/EditorPanel";
import InterviewOverlay from "./InterviewOverlay";
import HeaderControls from "./HeaderControls";
import RightPanel from "./RightPanel";
import CodingEvaluationDebugPanel from "./debug/CodingEvaluationDebugPanel";
import {
    InterviewProvider,
    useInterview,
    useJobApplication,
    useDebug,
    useMute,
} from "../../../shared/contexts";
import SfinxLogo from "../../../shared/components/SfinxLogo";
import { useCamera } from "./hooks/useCamera";
import { useInterviewTimer } from "./hooks/useInterviewTimer";
import { useThemePreference } from "./hooks/useThemePreference";
import { fetchJobById } from "./services/jobService";
import { useDispatch, useSelector } from "react-redux";
import { setCompanyContext, setSessionId, setStage } from "@/shared/state/slices/interviewSlice";
import { store, RootState } from "@/shared/state/store";
import { useInterviewRecording } from "./InterviewRecordingContext";

const logger = log;
const DEFAULT_CODING_DURATION_SECONDS = 30 * 60;
const DEFAULT_CODE = ``;
const VIDEO_EVIDENCE_OFFSET_MS = 1000; // Show video 1 second before iteration for context

/**
 * Returns the initial code template displayed in the editor when the interview starts.
 */
const getInitialCode = () => DEFAULT_CODE;

interface InterviewerContentProps {
    isDebugVisible: boolean;
    showDebugButton: boolean;
    evaluationDebugData: any;
    setEvaluationDebugData: (data: any) => void;
    isEvaluationLoading: boolean;
    setIsEvaluationLoading: (loading: boolean) => void;
    isDebugModeEnabled: boolean;
    onTestEvaluationReady: (callback: () => void) => void;
    nextEvaluationTime: Date | null;
    setNextEvaluationTime: (time: Date | null) => void;
    jobCategories: Array<{name: string; description: string; weight: number}> | null;
    setJobCategories: (categories: Array<{name: string; description: string; weight: number}> | null) => void;
    evaluationThrottleMs: number;
    setEvaluationThrottleMs: (ms: number) => void;
    micStream?: MediaStream | null;
}

/**
 * Main interview container: orchestrates UI state, timers, recording,
 * and conversation flow for the coding interview.
 */
const InterviewerContent: React.FC<InterviewerContentProps> = ({
    isDebugVisible,
    showDebugButton,
    evaluationDebugData,
    setEvaluationDebugData,
    isEvaluationLoading,
    setIsEvaluationLoading,
    isDebugModeEnabled,
    onTestEvaluationReady,
    nextEvaluationTime,
    setNextEvaluationTime,
    jobCategories,
    setJobCategories,
    evaluationThrottleMs,
    setEvaluationThrottleMs,
    micStream,
}) => {
    const {
        state,
        getCurrentTask,
        updateCurrentCode,
        updateSubmission,
        setCodingStarted,
        queueContextUpdate,
        queueUserMessage,
    } = useInterview();
    const { markCompanyApplied } = useJobApplication();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { data: session } = useSession();
    const dispatch = useDispatch();
    const reduxCompanySlug = useSelector((state: RootState) => state.interview.companySlug);
    const reduxRoleSlug = useSelector((state: RootState) => state.interview.roleSlug);
    const reduxUserId = useSelector((state: RootState) => state.interview.userId);
    const reduxApplicationId = useSelector((state: RootState) => state.interview.applicationId);
    const codingTimeboxSeconds = useSelector((state: RootState) => state.coding.timeboxSeconds);
    
    if (!reduxCompanySlug || !reduxRoleSlug) {
        throw new Error("Company and role not initialized in Redux");
    }
    const companyId = reduxCompanySlug;
    const jobId = `${reduxCompanySlug}-${reduxRoleSlug}`;
    
    const [job, setJob] = useState<any | null>(null);
    const codingDurationSeconds = codingTimeboxSeconds || DEFAULT_CODING_DURATION_SECONDS;
    
    const candidateName = (session?.user as any)?.name || "Candidate";

    /**
     * Queues a user-visible chat message to be sent to the agent.
     */
    const onSendUserMessage = useCallback(
        async (message: string) => {
            try {
                queueUserMessage(message);
                logger.info("✅ Queued user message:", message);
                return true;
            } catch (error) {
                logger.error("❌ Failed to queue user message:", error);
                return false;
            }
        },
        [queueUserMessage]
    );

    const [availableTabs, setAvailableTabs] = useState<
        Array<"editor" | "preview">
    >(["editor"]);
    const [activeTab, setActiveTab] = useState<"editor" | "preview">("editor");
    const [isInterviewActive, setIsInterviewActive] = useState(false);
    const [isInterviewLoading, setIsInterviewLoading] = useState(true);
    const [isAgentConnected, setIsAgentConnected] = useState(false);
    const [isCodingStarted, setIsCodingStarted] = useState(false);
    const [micMuted, setMicMuted] = useState(false);
    const [interviewConcluded, setInterviewConcluded] = useState(false);
    const [isChatInputLocked, setIsChatInputLocked] = useState(true);
    const [redirectDelayMs, setRedirectDelayMs] = useState<number>(4000);
    
    // Store interview script data for iteration tracking
    const [interviewScript, setInterviewScript] = useState<any>(null);
    const [lastEvaluation, setLastEvaluation] = useState<string | null>(null);

    const realTimeConversationRef = useRef<any>(null);
    const automaticMode = process.env.NEXT_PUBLIC_AUTOMATIC_MODE === "true";
    const timeboxFiredRef = useRef(false);
    const [runCodeClickTime, setRunCodeClickTime] = useState<Date>(new Date());
    const runCodeClickTimeRef = useRef<Date>(runCodeClickTime);

    // Real-time code evaluation state
    const CODE_EVALUATION_THROTTLE_MS = evaluationThrottleMs;
    const [previousCode, setPreviousCode] = useState("");
    const [codeChangeQueue, setCodeChangeQueue] = useState<Array<{
        timestamp: Date;
        code: string;
        previousCode: string;
    }>>([]);
    const evaluationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const editorInstanceRef = useRef<any>(null);
    
    // Set throttle from env on mount
    useEffect(() => {
        const envValue = process.env.NEXT_PUBLIC_CODE_EVALUATION_THROTTLE_MS;
        if (!envValue) {
            throw new Error("NEXT_PUBLIC_CODE_EVALUATION_THROTTLE_MS environment variable is required");
        }
        setEvaluationThrottleMs(Number(envValue));
    }, [setEvaluationThrottleMs]);

    // Keep ref in sync with state
    useEffect(() => {
        runCodeClickTimeRef.current = runCodeClickTime;
    }, [runCodeClickTime]);

    useThemePreference();

    const { isCameraOn, selfVideoRef, toggleCamera } = useCamera();
    const {
        recordingPermissionGranted,
        stopRecording,
        interviewSessionId,
        mediaRecorderRef,
        getActualRecordingStartTime,
    } = useInterviewRecording();
    const [applicationId, setApplicationId] = useState<string | null>(null);

    /**
     * Logs whenever the interview session ID changes (useful for tracing recording sessions).
     */
    useEffect(() => {
        logger.info("interviewSessionId changed to:", interviewSessionId);
    }, [interviewSessionId]);

    useEffect(() => {
        if (reduxApplicationId) {
            setApplicationId(reduxApplicationId);
        }
    }, [reduxApplicationId]);

    // Background timer removed - background phase handled in separate page

    /**
     * Sends a hidden signal instructing the agent to deliver its closing line and end.
     */
    const sendHiddenDoneMessage = useCallback(async () => {
        try {
            queueUserMessage(
                "I'm done. Please say your closing line and then end the connection."
            );
            logger.info("✅ Special 'I'm done' message queued successfully");
            return true;
        } catch (error) {
            logger.error("❌ Error sending 'I'm done' message:", error);
            return false;
        }
    }, [queueUserMessage]);

    const { timeLeft, isTimerRunning, startTimer, stopTimer, formatTime } =
        useInterviewTimer({
            durationSeconds: codingDurationSeconds,
            onExpire: async () => {
                logger.info("⏰ Timer expired - ending interview...");
                updateSubmission(state.currentCode);
                await stopRecording();
                // OpenAI flow: say closing line and end via response.done
                try {
                    const ref = realTimeConversationRef.current;
                    if (ref?.sayClosingLine && typeof ref.sayClosingLine === "function") {
                        await ref.sayClosingLine(candidateName);
                    }
                } catch {}
                setIsCodingStarted(false);
                setCodingStarted(false);
            },
        });

    /**
     * Enters coding mode and starts the interview timer.
     */
    const handleStartCoding = useCallback(async () => {
        log.info(LOG_CATEGORY, "🎯 handleStartCoding called");
        setIsCodingStarted(true);
        setCodingStarted(true);
        startTimer();
    }, [setCodingStarted, startTimer]);

    useEffect(() => {
        if (!automaticMode) {
            return;
        }
        const unsubscribe = store.subscribe(() => {
            const state = store.getState();
            const stage = state.interview?.stage;
            const currentCodingStarted = isCodingStarted; // Capture current state
            if (stage === "coding" && !currentCodingStarted) {
                void handleStartCoding();
            }
        });
        return () => unsubscribe();
    }, [automaticMode, handleStartCoding]);

    useEffect(() => {
        const prevStageRef = { current: store.getState().interview?.stage };
        const unsubscribe = store.subscribe(() => {
            const stage = store.getState().interview?.stage;
            if (
                stage === "coding" &&
                prevStageRef.current !== "coding"
            ) {
                setIsChatInputLocked(true);
            }
            prevStageRef.current = stage;
        });
        return () => unsubscribe();
    }, []);

    const handleCodingPromptReady = useCallback(() => {
        setIsChatInputLocked(false);
    }, []);

    const handleInterviewConcluded = useCallback(
        async (delayMs?: number) => {
            // Check for unanswered paste evaluation before concluding
            const codingState = store.getState().coding;
            const activePasteEval = codingState.activePasteEvaluation;
            
            if (activePasteEval && !activePasteEval.accountabilityScore && interviewSessionId) {
                // Check if there are partial answers (some questions answered but evaluation incomplete)
                const hasPartialAnswers = activePasteEval.questionScores && activePasteEval.questionScores.length > 0;
                
                if (hasPartialAnswers) {
                    // Calculate score from partial answers using topic percentages
                    const topics = activePasteEval.topics || [];
                    const avgScore = topics.length > 0
                        ? Math.round(topics.reduce((sum, t) => sum + t.percentage, 0) / topics.length)
                        : 0;
                    
                    const understanding = avgScore >= 80 ? "full" : avgScore >= 50 ? "partial" : "none";
                    
                    logger.info("📋 [PASTE_EVAL] Saving partially answered paste evaluation", {
                        avgScore,
                        answeredQuestions: activePasteEval.questionScores.length,
                        topics: topics.map(t => ({ name: t.name, pct: t.percentage }))
                    });

                    try {
                        // Generate caption using OpenAI
                        let caption = `External tool: ${understanding} understanding (${avgScore}/100)`;
                        try {
                            const summaryResponse = await fetch("/api/interviews/generate-paste-summary", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    pastedContent: activePasteEval.pastedContent,
                                    questionAnswers: activePasteEval.questionScores,
                                    averageScore: avgScore,
                                }),
                            });

                            if (summaryResponse.ok) {
                                const summaryData = await summaryResponse.json();
                                caption = summaryData.summary || caption;
                                logger.info("✅ [PASTE_EVAL] Generated caption:", caption);
                            } else {
                                logger.warn("⚠️ [PASTE_EVAL] Failed to generate caption, using fallback");
                            }
                        } catch (captionError) {
                            logger.error("❌ [PASTE_EVAL] Caption generation failed:", captionError);
                        }

                        const dbPayload = {
                            timestamp: activePasteEval.timestamp,
                            pastedContent: activePasteEval.pastedContent,
                            characterCount: activePasteEval.pastedContent.length,
                            aiQuestion: activePasteEval.questionScores.map((qs: any) => qs.question).join("\n"),
                            aiQuestionTimestamp: activePasteEval.aiQuestionTimestamp || Date.now(),
                            userAnswer: activePasteEval.questionScores.map((qs: any) => qs.answer).join("\n"),
                            understanding,
                            accountabilityScore: avgScore,
                            reasoning: `Candidate answered ${activePasteEval.questionScores.length} question(s) before submitting. ${activePasteEval.questionScores.map((qs: any, i: number) => `Q${i+1} (score: ${qs.score}): ${qs.reasoning}`).join(" ")}`,
                            caption,
                        };

                        const response = await fetch(`/api/interviews/session/${interviewSessionId}/external-tools`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(dbPayload),
                        });
                        
                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(`API returned ${response.status}: ${errorData.error || 'Unknown error'}`);
                        }
                        
                        logger.info("✅ [PASTE_EVAL] Saved partial paste evaluation");
                    } catch (error) {
                        logger.error("❌ [PASTE_EVAL] Failed to save partial paste:", error);
                    }
                } else {
                    // Truly unanswered - no questions answered at all
                    logger.info("📋 [PASTE_EVAL] Saving unanswered paste evaluation with score 0");
                    
                    // Save to DB with score 0 (failed accountability)
                    try {
                        const dbPayload = {
                            timestamp: activePasteEval.timestamp,
                            pastedContent: activePasteEval.pastedContent,
                            characterCount: activePasteEval.pastedContent.length,
                            aiQuestion: activePasteEval.topics?.map((t: any) => t.question).join("\n") || "No response provided",
                            aiQuestionTimestamp: activePasteEval.aiQuestionTimestamp || Date.now(),
                            userAnswer: "",
                            understanding: "none",
                            accountabilityScore: 0,
                            reasoning: "User submitted without answering paste accountability questions",
                            caption: "External Tool Usage - No Response",
                        };
                        
                        const response = await fetch(`/api/interviews/session/${interviewSessionId}/external-tools`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(dbPayload),
                        });
                        
                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(`API returned ${response.status}: ${errorData.error || 'Unknown error'}`);
                        }
                        
                        logger.info("✅ [PASTE_EVAL] Saved unanswered paste with score 0");
                    } catch (error) {
                        logger.error("❌ [PASTE_EVAL] Failed to save unanswered paste:", error);
                    }
                }
            }
            
            if (typeof delayMs === "number" && delayMs > 0) {
                setRedirectDelayMs(delayMs);
            } else {
                setRedirectDelayMs(4000);
            }
            setInterviewConcluded(true);
        },
        [interviewSessionId]
    );

    /**
     * Tests OpenAI evaluation without submitting the interview.
     * Stores request/response data for debug inspection.
     */
    const handleTestEvaluation = useCallback(async () => {
        logger.info("🧪 [TEST_EVAL] === Test Evaluation Button Clicked ===");
        logger.info("[TEST_EVAL] Session ID:", interviewSessionId);
        logger.info("[TEST_EVAL] Interview script present:", !!interviewScript);
        logger.info("[TEST_EVAL] Current code length:", state.currentCode.length);
        
        if (!interviewSessionId || !interviewScript) {
            logger.warn("⚠️ [TEST_EVAL] Cannot test evaluation: missing session or script");
            return;
        }

        logger.info("🚀 [TEST_EVAL] Starting OpenAI evaluation tests...");
        setIsEvaluationLoading(true);
        const debugData: any = { timestamp: Date.now() };

        try {
            // Test summary generation
            logger.info("[TEST_EVAL] 📝 Preparing summary generation request...");
            const summaryRequest = {
                sessionId: interviewSessionId,
                finalCode: state.currentCode,
                codingTask: interviewScript.codingPrompt,
                expectedSolution: interviewScript.codingAnswer,
            };
            debugData.summaryRequest = summaryRequest;
            logger.info("[TEST_EVAL] Summary request:", {
                sessionId: interviewSessionId,
                finalCodeLength: state.currentCode.length,
                codingTaskLength: interviewScript.codingPrompt.length,
            });

            logger.info("[TEST_EVAL] 🔄 Calling /api/interviews/generate-coding-summary...");
            const summaryResponse = await fetch("/api/interviews/generate-coding-summary", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(summaryRequest),
            });

            debugData.summaryResponse = {
                status: summaryResponse.status,
                statusText: summaryResponse.statusText,
                data: summaryResponse.ok ? await summaryResponse.json() : await summaryResponse.text(),
            };
            logger.info("[TEST_EVAL] ✅ Summary response:", {
                status: summaryResponse.status,
                ok: summaryResponse.ok,
                dataPreview: JSON.stringify(debugData.summaryResponse.data).substring(0, 200),
            });

            // Fetch iterations
            logger.info("[TEST_EVAL] 📝 Fetching iterations...");
            const iterationsUrl = `/api/interviews/session/${interviewSessionId}/iterations`;
            
            const iterationsResponse = await fetch(iterationsUrl);
            if (iterationsResponse.ok) {
                const iterationsData = await iterationsResponse.json();
                // API returns iterations as a direct array, not wrapped in an object
                debugData.iterations = Array.isArray(iterationsData) ? iterationsData : [];
                logger.info("[TEST_EVAL] ✅ Iterations fetched:", {
                    count: debugData.iterations.length,
                    data: debugData.iterations,
                });
            } else {
                logger.error("[TEST_EVAL] ❌ Failed to fetch iterations:", iterationsResponse.status);
                debugData.iterations = [];
            }

            setEvaluationDebugData(debugData);
            logger.info("✅ [TEST_EVAL] Test evaluation complete - all data:", debugData);
            logger.info("[TEST_EVAL] 📊 Debug panel should now display:", {
                hasSummaryData: !!debugData.summaryResponse,
                hasIterations: !!debugData.iterations,
                summaryStatus: debugData.summaryResponse?.status,
            });
            
            // Test job-specific coding evaluation
            logger.info("[TEST_EVAL] 🔄 Calling /api/interviews/evaluate-job-specific-coding...");
            const jobCategories = job?.codingCategories as Array<{name: string; description: string; weight: number}> | undefined;
            const jobEvalResponse = await fetch("/api/interviews/evaluate-job-specific-coding", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    finalCode: state.currentCode,
                    codingTask: interviewScript.codingPrompt,
                    categories: jobCategories || [],
                    referenceCode: interviewScript.codingAnswer,
                    expectedOutput: interviewScript.expectedOutput,
                    sessionId: interviewSessionId,
                }),
            });

            debugData.jobSpecificResponse = {
                status: jobEvalResponse.status,
                statusText: jobEvalResponse.statusText,
                data: jobEvalResponse.ok ? await jobEvalResponse.json() : await jobEvalResponse.text(),
            };
            logger.info("[TEST_EVAL] ✅ Job-specific evaluation response:", {
                status: jobEvalResponse.status,
                ok: jobEvalResponse.ok,
            });

            setEvaluationDebugData(debugData);
            
            // Auto-open debug panel if not visible (dispatch global event)
            if (!isDebugVisible && isDebugModeEnabled) {
                window.dispatchEvent(new CustomEvent('toggleDebugPanel'));
                logger.info("[TEST_EVAL] Debug panel auto-opened");
            } else {
                logger.info("[TEST_EVAL] Debug panel already visible or debug mode disabled");
            }
        } catch (error) {
            logger.error("❌ [TEST_EVAL] Test evaluation failed:", error);
            debugData.error = error instanceof Error ? error.message : String(error);
            setEvaluationDebugData(debugData);
        } finally {
            setIsEvaluationLoading(false);
            logger.info("[TEST_EVAL] Loading state set to false");
        }
    }, [interviewSessionId, interviewScript, state.currentCode, isDebugVisible, isDebugModeEnabled, setEvaluationDebugData, setIsEvaluationLoading, reduxUserId]);

    // Notify parent of handleTestEvaluation when it changes
    useEffect(() => {
        onTestEvaluationReady(handleTestEvaluation);
    }, [handleTestEvaluation, onTestEvaluationReady]);

    /**
     * Submits the current solution, stops recording, exits coding mode, and stops the timer.
     */
    const handleSubmit = useCallback(async () => {
        try {
            updateSubmission(state.currentCode);
            await stopRecording();

            // Trigger all post-interview processing asynchronously on the server.
            // The /process endpoint returns 202 immediately after marking the session
            // PROCESSING, so the candidate is never blocked waiting for AI computations.
            if (interviewSessionId && interviewScript) {
                const jobCategories = (job?.codingCategories as Array<{name: string; description: string; weight: number}> | undefined) ?? [];
                fetch(`/api/interviews/session/${interviewSessionId}/process`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        finalCode: state.currentCode,
                        codingTask: interviewScript.codingPrompt,
                        expectedSolution: interviewScript.codingAnswer,
                        expectedOutput: interviewScript.expectedOutput,
                        jobCategories,
                    }),
                }).catch((err) => logger.error(LOG_CATEGORY, "Failed to trigger processing:", err));
            }
            
            // OpenAI flow: say closing line and rely on response.done to end
            try {
                const ref = realTimeConversationRef.current;
                if (ref?.sayClosingLine && typeof ref.sayClosingLine === "function") {
                    await ref.sayClosingLine(candidateName);
                }
            } catch {}
            setCodingStarted(false);
            setIsCodingStarted(false);
            stopTimer();
        } catch (error) {
            logger.error("❌ Failed to submit solution:", error);
        }
    }, [candidateName, interviewScript, interviewSessionId, job, setCodingStarted, state.currentCode, stopRecording, stopTimer, updateSubmission]);

    /**
     * Starts the interview using the shared recording session created during the start flow.
     */
    const startInterview = useCallback(async () => {
        const skipScreenShare = process.env.NEXT_PUBLIC_SKIP_SCREEN_SHARE === "true";
        
        if (isInterviewActive) return;
        if (!skipScreenShare && (!recordingPermissionGranted || !mediaRecorderRef.current)) {
            logger.warn("Recording not initialized; skipping duplicate start prompt");
            return;
        }
        if (!interviewSessionId) {
            logger.warn("Missing interview session from start flow");
            return;
        }

        try {
            setIsInterviewLoading(true);
            setIsChatInputLocked(true);

            const recordingStart = getActualRecordingStartTime?.();
            if (recordingStart) {
                logger.info("Reusing recording started at:", recordingStart.toISOString());
            }

            updateCurrentCode(getInitialCode());
            window.postMessage({ type: "clear-chat" }, "*");

            await realTimeConversationRef.current?.startConversation();

            setIsInterviewActive(true);
            logger.info("Interview started successfully!");
        } catch (error) {
            logger.error("Failed to start interview:", error);
            setIsInterviewLoading(false);
        }
    }, [
        isInterviewActive,
        recordingPermissionGranted,
        mediaRecorderRef,
        interviewSessionId,
        setIsChatInputLocked,
        updateCurrentCode,
        dispatch,
        getActualRecordingStartTime,
    ]);

    /**
     * Start interview when IDE mounts.
     */
    useEffect(() => {
        if (!isInterviewActive) {
            logger.info("Starting interview");
            void startInterview();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /**
     * Toggles microphone mute state via the real-time conversation ref.
     */
    const toggleMicMute = useCallback(() => {
        if (realTimeConversationRef.current?.toggleMicMute) {
            realTimeConversationRef.current.toggleMicMute();
        }
    }, []);

    /**
     * Route guard: if no company is selected (and not on practice/training), redirect to job search.
     */
    useEffect(() => {
        const onPracticePage =
            typeof window !== "undefined" &&
            window.location.pathname === "/practice";
        const onTrainingPage =
            typeof window !== "undefined" &&
            window.location.pathname === "/interview/training";
        if (!companyId && !onPracticePage && !onTrainingPage) {
            router.push("/job-search");
        }
    }, [companyId, router]);

    /**
     * Fetches job details when `jobId` is available; cleans up if unmounted mid-request.
     */
    useEffect(() => {
        if (!jobId) return;
        let mounted = true;
        fetchJobById(jobId)
            .then((data) => {
                if (mounted) {
                    setJob(data.job);
                    // Extract and set job categories for debug panel
                    const categories = data?.job?.codingCategories as Array<{name: string; description: string; weight: number}> | undefined;
                    setJobCategories(categories || null);
                    timeboxFiredRef.current = false;
                }
            })
            .catch(() => {});
        return () => {
            mounted = false;
        };
    }, [jobId, dispatch, setJobCategories]);

    /**
     * Initializes editor content with the default snippet if empty.
     */
    useEffect(() => {
        // If no code yet, fetch the coding template once company/role are known (from Redux)
        (async () => {
            if (state.currentCode) return;
            if (!reduxCompanySlug || !reduxRoleSlug) return; // wait until company context is set in Redux
            const resp = await fetch(
                `/api/interviews/script?company=${reduxCompanySlug}&role=${reduxRoleSlug}`
            );
            if (!resp.ok) {
                const detail =
                    (await resp.text().catch(() => "")) || resp.statusText;
                throw new Error(
                    `Failed to load interview script for ${reduxCompanySlug}/${reduxRoleSlug}: ${detail}`
                );
            }
            const data = await resp.json();
            setInterviewScript(data); // Store script for iteration tracking
            const tmpl = String(data?.codingTemplate || "");
            if (tmpl.trim().length > 0) {
                updateCurrentCode(tmpl);
                setPreviousCode(tmpl); // Initialize previousCode with template
            }
        })().catch((error) => {
            logger.error("❌ Failed to load interview script:", error);
            throw error;
        });
    }, [state.currentCode, updateCurrentCode, reduxCompanySlug, reduxRoleSlug]);

    /**
     * Resets editor code for specific tasks (e.g., task1-userlist) when task changes.
     */
    useEffect(() => {
        const currentTask = getCurrentTask();
        if (currentTask?.id === "task1-userlist") {
            updateCurrentCode(getInitialCode());
        }
    }, [getCurrentTask, state.currentTaskId, updateCurrentCode]);

    /**
     * After interview concludes, mark application as applied and optionally redirect to job search or demo flow.
     */
    useEffect(() => {
        if (interviewConcluded && companyId) {
            try {
                markCompanyApplied(companyId);
                logger.info("✅ Interview completed successfully");
            } catch (error) {
                logger.error("❌ Error handling interview conclusion:", error);
            }

            const onPracticePage =
                typeof window !== "undefined" &&
                window.location.pathname === "/practice";

            if (!onPracticePage) {
                const delay = typeof redirectDelayMs === "number" ? redirectDelayMs : 4000;
                setTimeout(() => {
                    try {
                        const destination = "/job-search";
                        window.location.href = destination;
                    } catch {
                        const destination = "/job-search";
                        router.push(destination as any);
                    }
                }, delay);
            }
        }
    }, [interviewConcluded, companyId, router, markCompanyApplied, redirectDelayMs, reduxUserId, interviewSessionId, applicationId]);

    /**
     * Listens for mic mute/unmute messages from child frames and syncs local state.
     */
    useEffect(() => {
        const handleMicStateChange = (event: MessageEvent) => {
            if (event.data.type === "mic-state-changed") {
                setMicMuted(event.data.micMuted);
            }
        };

        window.addEventListener("message", handleMicStateChange);
        return () =>
            window.removeEventListener("message", handleMicStateChange);
    }, []);

    /**
     * Generates a readable diff between old and new code with context
     */
    const generateDiff = useCallback((oldCode: string, newCode: string): string => {
        const oldLines = oldCode.split('\n');
        const newLines = newCode.split('\n');
        const diff: string[] = [];
        
        let i = 0, j = 0;
        while (i < oldLines.length || j < newLines.length) {
            if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
                // Lines match - skip (don't show unchanged lines)
                i++;
                j++;
            } else {
                // Find where lines sync back up
                let syncFound = false;
                for (let lookAhead = 1; lookAhead <= 3; lookAhead++) {
                    if (i + lookAhead < oldLines.length && oldLines[i + lookAhead] === newLines[j]) {
                        // Deletion - lines were removed
                        for (let k = 0; k < lookAhead; k++) {
                            diff.push(`- ${oldLines[i + k]}`);
                        }
                        i += lookAhead;
                        syncFound = true;
                        break;
                    }
                    if (j + lookAhead < newLines.length && oldLines[i] === newLines[j + lookAhead]) {
                        // Insertion - lines were added
                        for (let k = 0; k < lookAhead; k++) {
                            diff.push(`+ ${newLines[j + k]}`);
                        }
                        j += lookAhead;
                        syncFound = true;
                        break;
                    }
                }
                
                if (!syncFound) {
                    // Different lines at same position - show both
                    if (i < oldLines.length) {
                        diff.push(`- ${oldLines[i]}`);
                        i++;
                    }
                    if (j < newLines.length) {
                        diff.push(`+ ${newLines[j]}`);
                        j++;
                    }
                }
            }
        }
        
        return diff.join('\n');
    }, []);

    /**
     * Checks if code change is substantial enough to evaluate
     */
    const isSubstantialChange = useCallback((oldCode: string, newCode: string): boolean => {
        // Always evaluate - no minimum threshold
        return oldCode !== newCode;
    }, []);

    /**
     * Evaluates code change and creates evidence clips
     */
    const evaluateCodeChange = useCallback(async ({
        previousCode: prevCode,
        currentCode: currCode,
        timestamp
    }: {
        previousCode: string;
        currentCode: string;
        timestamp: Date;
    }) => {
        if (!interviewSessionId || !job?.codingCategories) {
            return;
        }

        try {
            const diff = generateDiff(prevCode, currCode);
            
            logger.info("[CODE-EVAL] ===== EVALUATION REQUEST =====");
            logger.info("[CODE-EVAL] Timestamp:", timestamp.toISOString());
            logger.info("[CODE-EVAL] Previous code length:", prevCode.length);
            logger.info("[CODE-EVAL] Current code length:", currCode.length);
            logger.info("[CODE-EVAL] --- FULL CURRENT CODE ---");
            logger.info(currCode);
            logger.info("[CODE-EVAL] --- DIFF BEING SENT ---");
            logger.info(diff);
            logger.info("[CODE-EVAL] ============================");

            const requestPayload = {
                sessionId: interviewSessionId,
                previousCode: prevCode,
                currentCode: currCode,
                diff: diff,
                timestamp: timestamp.toISOString(),
                jobCategories: job.codingCategories,
                referenceCode: interviewScript?.codingAnswer,
                expectedOutput: interviewScript?.expectedOutput
            };
            
            const response = await fetch("/api/interviews/evaluate-code-change", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(requestPayload)
            });
            
            if (response.ok) {
                const data = await response.json();
                logger.info(`[CODE-EVAL] ✅ Evaluated: ${data.contributionsCount || 0} contributions`);
                
                // Update debug panel with real-time contribution data
                setEvaluationDebugData((prev: any) => ({
                    ...prev,
                    realtimeContributions: [
                        ...(prev?.realtimeContributions || []),
                        {
                            timestamp: timestamp.toISOString(),
                            request: {
                                currentCode: currCode,
                                diff: diff,
                                jobCategories: job.codingCategories
                            },
                            response: data
                        }
                    ]
                }));
            } else {
                logger.error("[CODE-EVAL] ❌ Failed to evaluate code change:", response.status);
            }
        } catch (error) {
            logger.error("[CODE-EVAL] ❌ Error evaluating code change:", error);
        }
    }, [interviewSessionId, job, generateDiff, setEvaluationDebugData, interviewScript]);

    /**
     * Updates editor code state when user edits.
     * Includes real-time evaluation throttling.
     */
    const handleCodeChange = useCallback(
        (code: string) => {
            updateCurrentCode(code);
            
            // Debug logging
            logger.info("[CODE-CHANGE]", {
                isCodingStarted,
                hasJob: !!job,
                hasCodingCategories: !!job?.codingCategories,
                categoriesCount: job?.codingCategories?.length
            });
            
            // Only track for real-time evaluation if coding has started
            if (!isCodingStarted || !job?.codingCategories) {
                logger.info("[CODE-CHANGE] Skipping evaluation - not ready");
                return;
            }

            // CRITICAL: Capture timestamp IMMEDIATELY when code changes
            const changeTimestamp = new Date();
            
            logger.info("[CODE-CHANGE] Adding to queue, timestamp:", changeTimestamp.toISOString());
            
            // Store this change with its exact timestamp
            setCodeChangeQueue(queue => [...queue, {
                timestamp: changeTimestamp,
                code: code,
                previousCode: previousCode
            }]);
            
            // Clear existing timeout
            if (evaluationTimeoutRef.current) {
                logger.info("[CODE-CHANGE] Clearing existing timeout");
                clearTimeout(evaluationTimeoutRef.current);
            }
            
            // Throttle: evaluate after 3 seconds of inactivity
            const evaluationTime = new Date(Date.now() + CODE_EVALUATION_THROTTLE_MS);
            setNextEvaluationTime(evaluationTime);
            logger.info("[CODE-CHANGE] Setting 3-second timeout, will evaluate at:", evaluationTime.toISOString());
            
            evaluationTimeoutRef.current = setTimeout(() => {
                logger.info("[CODE-CHANGE] ⏰ Timeout fired! Evaluating...");
                
                // Get the current queue
                setCodeChangeQueue(currentQueue => {
                    logger.info("[CODE-CHANGE] Queue length:", currentQueue.length);
                    
                    if (currentQueue.length === 0) {
                        setNextEvaluationTime(null);
                        return currentQueue;
                    }
                    
                    // Check for Monaco syntax errors before evaluating
                    if (editorInstanceRef.current) {
                        const model = editorInstanceRef.current.getModel();
                        if (model) {
                            const monaco = (window as any).monaco;
                            if (monaco) {
                                const markers = monaco.editor.getModelMarkers({ resource: model.uri });
                                logger.info("[CODE-CHANGE] Monaco markers found:", markers.length);
                                
                                const errors = markers.filter((m: any) => m.severity === monaco.MarkerSeverity.Error);
                                logger.info("[CODE-CHANGE] Syntax errors found:", errors.length);
                                
                                if (errors.length > 0) {
                                    logger.info("[CODE-CHANGE] ❌ Skipping evaluation - code has syntax errors:", errors.map((e: any) => ({ line: e.startLineNumber, message: e.message })));
                                    Promise.resolve().then(() => setNextEvaluationTime(null));
                                    return []; // Clear queue but don't evaluate
                                }
                            } else {
                                logger.info("[CODE-CHANGE] ⚠️ Monaco not available");
                            }
                        } else {
                            logger.info("[CODE-CHANGE] ⚠️ Editor model not available");
                        }
                    } else {
                        logger.info("[CODE-CHANGE] ⚠️ Editor instance not available");
                    }
                    
                    // Get the FIRST change in queue (earliest timestamp) and LAST change (latest code)
                    const firstChange = currentQueue[0];
                    const lastChange = currentQueue[currentQueue.length - 1];
                    
                    logger.info("[CODE-CHANGE] First change timestamp:", firstChange.timestamp.toISOString());
                    logger.info("[CODE-CHANGE] Last change code length:", lastChange.code.length);
                    logger.info("[CODE-CHANGE] Previous code length:", firstChange.previousCode.length);
                    
                    // Only evaluate if substantial change
                    if (isSubstantialChange(firstChange.previousCode, lastChange.code)) {
                        // Trigger evaluation (non-blocking)
                        Promise.resolve().then(() => {
                            evaluateCodeChange({
                                previousCode: firstChange.previousCode,
                                currentCode: lastChange.code,
                                timestamp: firstChange.timestamp,
                            });
                        });
                        
                        // Update tracking
                        Promise.resolve().then(() => {
                            setPreviousCode(lastChange.code);
                            setNextEvaluationTime(null);
                        });
                    } else {
                        logger.info("[CODE-CHANGE] Change not substantial enough, skipping");
                        Promise.resolve().then(() => {
                            setNextEvaluationTime(null);
                        });
                    }
                    
                    return []; // Clear the queue
                });
            }, CODE_EVALUATION_THROTTLE_MS);
        },
        [updateCurrentCode, isCodingStarted, job, previousCode, codeChangeQueue, isSubstantialChange, evaluateCodeChange]
    );

    /**
     * Handles execution result from CodePreview after Run is clicked.
     * Evaluates output against expected and saves iteration to DB.
     */
    const handleExecutionResult = useCallback(
        async (result: { status: "success" | "error"; output: string }) => {
            logger.info("🔔 [ITERATION] === handleExecutionResult CALLED ===");
            logger.info("[ITERATION] Result:", {
                status: result.status,
                outputLength: result.output.length,
                outputPreview: result.output.substring(0, 150),
            });
            logger.info("[ITERATION] Session ID:", interviewSessionId);
            logger.info("[ITERATION] Expected output:", interviewScript?.expectedOutput);
            
            if (!interviewSessionId || !interviewScript?.expectedOutput) {
                logger.info("⚠️ [ITERATION] Skipping iteration tracking - missing session ID or expected output");
                return;
            }

            try {
                logger.info("📊 [ITERATION] Starting iteration tracking - evaluating output");

                // Get current code snapshot
                const codeSnapshot = state.currentCode;

                // Call OpenAI evaluation endpoint
                const evalResponse = await fetch("/api/interviews/evaluate-output", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        actualOutput: result.output,
                        expectedOutput: interviewScript.expectedOutput,
                        codingTask: interviewScript.codingPrompt,
                        codeSnapshot,
                    }),
                });

                if (!evalResponse.ok) {
                    logger.error("Failed to evaluate iteration");
                    return;
                }

                const evaluation = await evalResponse.json();
                logger.info("✅ [ITERATION] Evaluation result:", evaluation);

                // Save iteration to DB (all iterations are evidence-worthy)
                const url = `/api/interviews/session/${interviewSessionId}/iterations`;

                // Use the Run button click time for accurate video timing
                const clickTime = runCodeClickTimeRef.current;
                const evidenceTimestamp = new Date(clickTime.getTime() - VIDEO_EVIDENCE_OFFSET_MS);

                logger.info("🎯 [ITERATION] Timestamp calculation:");
                logger.info("  - Run button clicked at:", clickTime.toISOString());
                logger.info("  - Evidence timestamp (click - 1s):", evidenceTimestamp.toISOString());
                logger.info("  - Evaluation completed at:", new Date().toISOString());

                const body: Record<string, any> = {
                    timestamp: evidenceTimestamp.toISOString(),
                    codeSnapshot,
                    actualOutput: result.output,
                    expectedOutput: interviewScript.expectedOutput,
                    evaluation: evaluation.evaluation,
                    reasoning: evaluation.reasoning,
                    matchPercentage: evaluation.matchPercentage,
                    caption: evaluation.caption,
                };

                logger.info("💾 [ITERATION] Saving to DB:", {
                    url,
                    clickTime: clickTime.toISOString(),
                    evidenceTimestamp: body.timestamp,
                    codeLength: codeSnapshot.length,
                    actualOutputLength: result.output.length,
                    evaluation: body.evaluation,
                    matchPercentage: body.matchPercentage,
                    caption: body.caption,
                });

                const saveResponse = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                });

                logger.info("[ITERATION] Save response status:", saveResponse.status);
                
                if (saveResponse.ok) {
                    const savedData = await saveResponse.json();
                    logger.info("✅ [ITERATION] Iteration saved to DB:", savedData);
                    setLastEvaluation(evaluation.evaluation);

                    // Update evaluationDebugData to show in Output tab immediately
                    setEvaluationDebugData((prev: any) => ({
                        ...prev,
                        iterations: [...(prev?.iterations || []), savedData]
                    }));
                } else {
                    const errorText = await saveResponse.text();
                    logger.error("❌ [ITERATION] Failed to save iteration:", errorText);
                }
            } catch (error) {
                logger.error("❌ Error tracking iteration:", error);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [interviewSessionId, interviewScript, reduxUserId]
        // Note: runCodeClickTime intentionally omitted to prevent re-execution on state change
    );

    /**
     * Switches to the preview tab, adding it if not present.
     */
    const handleRunCode = useCallback(() => {
        const clickTime = new Date();
        setRunCodeClickTime(clickTime);
        
        logger.info("🏃 [ITERATION] Run Code button clicked");
        logger.info("[ITERATION] Click timestamp:", clickTime.toISOString());
        logger.info("[ITERATION] Current code length:", state.currentCode.length);
        logger.info("[ITERATION] Active tab:", activeTab);
        logger.info("[ITERATION] Available tabs:", availableTabs);
        
        if (!availableTabs.includes("preview")) {
            setAvailableTabs((tabs) => [...tabs, "preview"]);
            logger.info("[ITERATION] Added preview tab to available tabs");
        }
        setActiveTab("preview");
        logger.info("[ITERATION] Switched to preview tab - code will execute");
    }, [availableTabs, activeTab, state.currentCode]);

    /**
     * Switches between editor and preview tabs if the tab exists.
     */
    const handleTabSwitch = useCallback(
        (tab: "editor" | "preview") => {
            if (availableTabs.includes(tab)) {
                setActiveTab(tab);
            }
        },
        [availableTabs]
    );

    const companyLogo = useMemo(() => job?.company?.logo, [job]);

    const handleSignOut = async () => {
        await signOut({ callbackUrl: "/login" });
    };

    const { isMuted, toggleMute } = useMute();

    const role = (session?.user as any)?.role;
    const settingsPath = role === "COMPANY" ? "/company-dashboard/settings" : "/settings";

    return (
        <div className="h-screen flex flex-col bg-soft-white text-deep-slate dark:bg-gray-900 dark:text-white relative">
            <header className="border-b border-gray-200/30 dark:border-gray-700/30 bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl px-6 py-4">
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

                        {/* HeaderControls (Camera, Timer, Start/Submit) */}
                        <HeaderControls
                            isCodingStarted={isCodingStarted}
                            hasSubmitted={Boolean(state.hasSubmitted)}
                            timeLeft={timeLeft}
                            formatTime={formatTime}
                            automaticMode={automaticMode}
                            isInterviewActive={Boolean(isInterviewActive)}
                            onStartCoding={handleStartCoding}
                            onSubmit={handleSubmit}
                            isDebugModeEnabled={false}
                            isDebugVisible={false}
                            onToggleDebug={() => {}}
                            codingDurationSeconds={codingDurationSeconds}
                        />

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

            <div className="flex-1 overflow-hidden">
                <PanelGroup direction="horizontal">
                    <Panel defaultSize={70} minSize={50}>
                        <div className="h-full border-r bg-white border-light-gray dark:bg-gray-800 dark:border-gray-700 relative">
                            <EditorPanel
                                currentCode={state.currentCode}
                                language={interviewScript?.codingLanguage}
                                fileName={interviewScript?.codingLanguage === "python" ? "main.py" : interviewScript?.codingLanguage === "java" ? "Main.java" : "index.tsx"}
                                onCodeChange={handleCodeChange}
                                onEditorReady={(editor) => { editorInstanceRef.current = editor; }}
                                availableTabs={availableTabs}
                                activeTab={activeTab}
                                onTabSwitch={handleTabSwitch}
                                onRunCode={handleRunCode}
                                readOnly={!isCodingStarted}
                                onPasteDetected={(pastedCode, timestamp) => {
                                    try {
                                        const ref = realTimeConversationRef.current;
                                        if (ref?.handlePasteDetected) {
                                            ref.handlePasteDetected(pastedCode, timestamp);
                                        }
                                    } catch {}
                                }}
                                onHighlightPastedCode={(pastedCode) => {
                                    if ((window as any).__highlightPastedCode) {
                                        (window as any).__highlightPastedCode(pastedCode);
                                    }
                                }}
                                onAskFollowup={(payload) => {
                                    try {
                                        const ref =
                                            realTimeConversationRef.current;
                                        if (
                                            ref?.askFollowupOnDelta &&
                                            typeof ref.askFollowupOnDelta ===
                                                "function"
                                        ) {
                                            ref.askFollowupOnDelta(payload);
                                        }
                                    } catch {}
                                }}
                                onExecutionResult={handleExecutionResult}
                                isCameraOn={isCameraOn}
                                selfVideoRef={selfVideoRef}
                            />
                        </div>
                    </Panel>

                    <PanelResizeHandle className="w-2 bg-light-gray hover:bg-electric-blue dark:bg-gray-600 dark:hover:bg-gray-500" />

                    <Panel defaultSize={30} minSize={25}>
                        <RightPanel
                            isInterviewActive={isInterviewActive}
                            candidateName={candidateName}
                            codingDurationSeconds={codingDurationSeconds}
                            automaticMode={automaticMode}
                            isCodingStarted={isCodingStarted}
                            onAutoStartCoding={() => {
                                if (!isCodingStarted) {
                                    void handleStartCoding();
                                }
                            }}
                            onStartConversation={() => {
                                logger.info("Conversation started");
                                setIsInterviewLoading(false);
                            }}
                            onEndConversation={() => {
                                logger.info("Conversation ended");
                                stopTimer();
                                setIsCodingStarted(false);
                                setCodingStarted(false);
                                setIsInterviewLoading(false);
                                setIsChatInputLocked(false);
                            }}
                            onInterviewConcluded={handleInterviewConcluded}
                            micMuted={micMuted}
                            onToggleMicMute={toggleMicMute}
                            realTimeConversationRef={realTimeConversationRef}
                            isAgentConnected={isAgentConnected}
                            setIsAgentConnected={setIsAgentConnected}
                            setIsInterviewActive={setIsInterviewActive}
                            onStopTimer={stopTimer}
                            isTextInputLocked={isChatInputLocked}
                            onCodingPromptReady={handleCodingPromptReady}
                            onGreetingDelivered={() => setIsChatInputLocked(false)}
                            setInputLocked={setIsChatInputLocked}
                            onHighlightPastedCode={(pastedCode) => {
                                if ((window as any).__highlightPastedCode) {
                                    (window as any).__highlightPastedCode(pastedCode);
                                }
                            }}
                            interviewSessionId={interviewSessionId}
                            userId={reduxUserId || undefined}
                            micStream={micStream}
                        />
                    </Panel>
                </PanelGroup>
            </div>
            <InterviewOverlay
                isCodingStarted={isCodingStarted}
                isInterviewActive={isInterviewActive}
                isInterviewLoading={isInterviewLoading}
                isAgentConnected={isAgentConnected}
                interviewConcluded={interviewConcluded}
                hasSubmitted={state.hasSubmitted}
                candidateName={candidateName}
            />
        </div>
    );
};

/**
 * Wrapper component that renders both the main content and debug panel
 */
const InterviewIDEWithDebug = ({ micStream }: InterviewIDEProps) => {
    const { isDebugVisible, showDebugButton } = useDebug();
    const isDebugModeEnabled = process.env.NEXT_PUBLIC_DEBUG_MODE === "true";
    const [evaluationDebugData, setEvaluationDebugData] = useState<any>(null);
    const [isEvaluationLoading, setIsEvaluationLoading] = useState(false);
    const [testEvaluationCallback, setTestEvaluationCallback] = useState<(() => void) | null>(null);
    const [nextEvaluationTime, setNextEvaluationTime] = useState<Date | null>(null);
    const [jobCategories, setJobCategories] = useState<Array<{name: string; description: string; weight: number}> | null>(null);
    const [evaluationThrottleMs, setEvaluationThrottleMs] = useState(() => {
        const envValue = process.env.NEXT_PUBLIC_CODE_EVALUATION_THROTTLE_MS;
        if (!envValue) {
            throw new Error("NEXT_PUBLIC_CODE_EVALUATION_THROTTLE_MS environment variable is required");
        }
        return Number(envValue);
    });

    const onTestEvaluationReady = useCallback((callback: () => void) => {
        setTestEvaluationCallback(() => callback);
    }, []);
    
    const onTestEvaluation = useCallback(() => {
        if (testEvaluationCallback) {
            testEvaluationCallback();
        }
    }, [testEvaluationCallback]);
    
    return (
        <div>
            <InterviewerContent
                isDebugVisible={isDebugVisible}
                showDebugButton={showDebugButton}
                evaluationDebugData={evaluationDebugData}
                setEvaluationDebugData={setEvaluationDebugData}
                isEvaluationLoading={isEvaluationLoading}
                setIsEvaluationLoading={setIsEvaluationLoading}
                nextEvaluationTime={nextEvaluationTime}
                setNextEvaluationTime={setNextEvaluationTime}
                isDebugModeEnabled={isDebugModeEnabled}
                onTestEvaluationReady={onTestEvaluationReady}
                jobCategories={jobCategories}
                setJobCategories={setJobCategories}
                evaluationThrottleMs={evaluationThrottleMs}
                setEvaluationThrottleMs={setEvaluationThrottleMs}
                micStream={micStream}
            />
            
            {/* Debug Panel - below IDE in document flow, scroll down to see it */}
            {isDebugVisible && isDebugModeEnabled && (
                <div className="w-full p-4">
                    <CodingEvaluationDebugPanel 
                        evaluationData={evaluationDebugData} 
                        isLoading={isEvaluationLoading}
                        onTestEvaluation={onTestEvaluation}
                        nextEvaluationTime={nextEvaluationTime}
                        jobCategories={jobCategories}
                        evaluationThrottleMs={evaluationThrottleMs}
                    />
                </div>
            )}
        </div>
    );
};

/**
 * Root wrapper that provides interview context and renders the main content.
 */
interface InterviewIDEProps {
    micStream?: MediaStream | null;
}

const InterviewIDE = ({ micStream }: InterviewIDEProps) => {
    return (
        <InterviewProvider>
            <InterviewIDEWithDebug micStream={micStream} />
        </InterviewProvider>
    );
};

export default InterviewIDE;
