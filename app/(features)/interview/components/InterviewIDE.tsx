"use client";

import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import Image from "next/image";
import { useSession } from "next-auth/react";
import EditorPanel from "./editor/EditorPanel";
import InterviewOverlay from "./InterviewOverlay";
import CameraPreview from "./CameraPreview";
import HeaderControls from "./HeaderControls";
import RightPanel from "./RightPanel";
import CodingEvaluationDebugPanel from "./debug/CodingEvaluationDebugPanel";
import {
    InterviewProvider,
    useInterview,
    useJobApplication,
} from "../../../shared/contexts";
import { useElevenLabsStateMachine } from "../../../shared/hooks/useElevenLabsStateMachine";
import { log } from "../../../shared/services";
import { useCamera } from "./hooks/useCamera";
import { useScreenRecording } from "./hooks/useScreenRecording";
import { useInterviewTimer } from "./hooks/useInterviewTimer";
import { useThemePreference } from "./hooks/useThemePreference";
import { createApplication } from "./services/applicationService";
import { createInterviewSession } from "./services/interviewSessionService";
import { fetchJobById } from "./services/jobService";
import { useDispatch } from "react-redux";
import { forceCoding, setCompanyContext, setSessionId } from "@/shared/state/slices/interviewMachineSlice";
import { interviewChatStore } from "@/shared/state/interviewChatStore";
import { store } from "@/shared/state/store";

const logger = log;
const DEFAULT_CODING_DURATION_SECONDS = 30 * 60;
const DEFAULT_CODE = ``;

/**
 * Returns the initial code template displayed in the editor when the interview starts.
 */
const getInitialCode = () => DEFAULT_CODE;

interface InterviewerContentProps {
    isDebugVisible: boolean;
    setIsDebugVisible: (visible: boolean) => void;
    evaluationDebugData: any;
    setEvaluationDebugData: (data: any) => void;
    isEvaluationLoading: boolean;
    setIsEvaluationLoading: (loading: boolean) => void;
    toggleDebugPanel: () => void;
    isDebugModeEnabled: boolean;
    onTestEvaluationReady: (callback: () => void) => void;
}

/**
 * Main interview container: orchestrates UI state, timers, recording,
 * and the ElevenLabs-driven state machine for conversation and coding flow.
 */
const InterviewerContent: React.FC<InterviewerContentProps> = ({
    isDebugVisible,
    setIsDebugVisible,
    evaluationDebugData,
    setEvaluationDebugData,
    isEvaluationLoading,
    setIsEvaluationLoading,
    toggleDebugPanel,
    isDebugModeEnabled,
    onTestEvaluationReady,
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
    const searchParams = useSearchParams();
    const router = useRouter();
    const { data: session } = useSession();
    const companyId = searchParams.get("companyId");
    const jobId = searchParams.get("jobId");
    const dispatch = useDispatch();
    const [job, setJob] = useState<any | null>(null);
    const [codingDurationSeconds, setCodingDurationSeconds] = useState(
        DEFAULT_CODING_DURATION_SECONDS
    );
    const isDemoMode = searchParams.get("demo") === "true";
    const demoUserId = searchParams.get("userId");
    const [demoCandidateName, setDemoCandidateName] = useState<string | null>(null);
    
    const candidateName = isDemoMode 
        ? (demoCandidateName || "Candidate")
        : ((session?.user as any)?.name || "Candidate");

    /**
     * Queues a contextual knowledge-base update for the agent (non-blocking).
     */
    const onElevenLabsUpdate = useCallback(
        async (text: string) => {
            try {
                queueContextUpdate(text);
                logger.info("✅ Queued ElevenLabs KB update:", text);
            } catch (error) {
                logger.error("❌ Failed to queue ElevenLabs update:", error);
                throw error;
            }
        },
        [queueContextUpdate]
    );

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

    const {
        setCodingState,
        handleSubmission: stateMachineHandleSubmission,
        kbVariables,
        handleUserTranscript,
        updateKBVariables,
    } = useElevenLabsStateMachine(
        onElevenLabsUpdate,
        onSendUserMessage,
        candidateName
    );

    const [availableTabs, setAvailableTabs] = useState<
        Array<"editor" | "preview">
    >(["editor"]);
    const [activeTab, setActiveTab] = useState<"editor" | "preview">("editor");
    const [isInterviewActive, setIsInterviewActive] = useState(false);
    const [isInterviewLoading, setIsInterviewLoading] = useState(false);
    const [isAgentConnected, setIsAgentConnected] = useState(false);
    const [isCodingStarted, setIsCodingStarted] = useState(false);
    const [micMuted, setMicMuted] = useState(false);
    const [applicationCreated, setApplicationCreated] = useState(false);
    const [interviewConcluded, setInterviewConcluded] = useState(false);
    const [isChatInputLocked, setIsChatInputLocked] = useState(true);
    const [redirectDelayMs, setRedirectDelayMs] = useState<number>(4000);
    
    // Store interview script data for iteration tracking
    const [interviewScript, setInterviewScript] = useState<any>(null);
    const [lastEvaluation, setLastEvaluation] = useState<string | null>(null);

    const realTimeConversationRef = useRef<any>(null);
    const automaticMode = process.env.NEXT_PUBLIC_AUTOMATIC_MODE === "true";
    const commMethodRaw = (process.env.NEXT_PUBLIC_INTERVIEW_COMM_METHOD || "speech")
        .toLowerCase()
        .trim();
    const isTextMode =
        commMethodRaw === "text" ||
        commMethodRaw === "true" ||
        commMethodRaw === "1" ||
        commMethodRaw === "yes";
    const timeboxFiredRef = useRef(false);
    const autoStartTriggeredRef = useRef(false);
    const runCodeClickTimeRef = useRef<Date | null>(null);

    useThemePreference();

    const { isCameraOn, selfVideoRef, toggleCamera } = useCamera();
    const {
        startRecording,
        stopRecording,
        insertRecordingUrl,
        interviewSessionId,
        setInterviewSessionId,
        getActualRecordingStartTime,
    } = useScreenRecording(isDemoMode);
    const [applicationId, setApplicationId] = useState<string | null>(null);

    /**
     * Logs whenever the interview session ID changes (useful for tracing recording sessions).
     */
    useEffect(() => {
        logger.info("interviewSessionId changed to:", interviewSessionId);
    }, [interviewSessionId]);

    /**
     * Fetch demo candidate name when in demo mode.
     */
    useEffect(() => {
        if (isDemoMode && demoUserId) {
            fetch(`/api/candidates/${demoUserId}/basic?skip-auth=true`)
                .then((res) => res.json())
                .then((data) => {
                    if (data.name) {
                        setDemoCandidateName(data.name);
                        logger.info("Demo candidate name fetched:", data.name);
                    }
                })
                .catch((err) => logger.error("Failed to fetch demo candidate name:", err));
        }
    }, [isDemoMode, demoUserId]);

    // Background timer removed - background phase handled in separate page

    /**
     * Sends a hidden signal instructing the agent to deliver its closing line and end.
     * Note: This is intended for the mode where ElevenLabs is the interviewer.
     * When the Human is the interviewer, this should be disabled and not sent.
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
                await insertRecordingUrl();
                await stateMachineHandleSubmission(state.currentCode);
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
        setIsCodingStarted(true);
        setCodingStarted(true);
        await setCodingState(true);
        startTimer();
    }, [setCodingStarted, setCodingState, startTimer]);

    useEffect(() => {
        if (!automaticMode || isTextMode) {
            return;
        }
        const unsubscribe = store.subscribe(() => {
            const machineState = store.getState().interviewMachine?.state;
            if (machineState === "in_coding_session" && !isCodingStarted) {
                void handleStartCoding();
            }
        });
        return () => unsubscribe();
    }, [automaticMode, handleStartCoding, isCodingStarted, isTextMode]);

    useEffect(() => {
        if (!isTextMode) {
            return;
        }
        const prevStateRef = { current: store.getState().interviewMachine?.state };
        const unsubscribe = store.subscribe(() => {
            const machineState = store.getState().interviewMachine?.state;
            if (
                machineState === "in_coding_session" &&
                prevStateRef.current !== "in_coding_session"
            ) {
                setIsChatInputLocked(true);
            }
            prevStateRef.current = machineState;
        });
        return () => unsubscribe();
    }, [isTextMode]);

    const handleCodingPromptReady = useCallback(() => {
        setIsChatInputLocked(false);
    }, []);

    const handleInterviewConcluded = useCallback(
        (delayMs?: number) => {
            if (typeof delayMs === "number" && delayMs > 0) {
                setRedirectDelayMs(delayMs);
            } else {
                setRedirectDelayMs(4000);
            }
            setInterviewConcluded(true);
        },
        []
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
            const iterationsUrl = isDemoMode
                ? `/api/interviews/session/${interviewSessionId}/iterations?skip-auth=true`
                : `/api/interviews/session/${interviewSessionId}/iterations`;
            
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
            
            // Auto-open debug panel if not visible
            if (!isDebugVisible && isDebugModeEnabled) {
                setIsDebugVisible(true);
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
    }, [interviewSessionId, interviewScript, state.currentCode, isDebugVisible, isDebugModeEnabled, setIsDebugVisible, setEvaluationDebugData, setIsEvaluationLoading, isDemoMode, demoUserId]);

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
            await insertRecordingUrl();
            await stateMachineHandleSubmission(state.currentCode);
            
            // Generate coding gaps and summary from session data
            setIsInterviewLoading(true);
            if (interviewSessionId && interviewScript) {
                logger.info("Generating coding gaps for session:", interviewSessionId);
                try {
                    const gapsResponse = await fetch("/api/interviews/generate-coding-gaps", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            sessionId: interviewSessionId,
                            finalCode: state.currentCode,
                            codingTask: interviewScript.codingPrompt,
                            expectedSolution: interviewScript.codingAnswer,
                        }),
                    });
                    
                    if (gapsResponse.ok) {
                        const gapsData = await gapsResponse.json();
                        logger.info("✅ Coding gaps generated:", gapsData.gapsCount);
                    } else {
                        logger.error("Failed to generate coding gaps:", gapsResponse.status);
                    }
                } catch (gapsError) {
                    logger.error("Error generating coding gaps:", gapsError);
                }

                // Generate coding summary
                logger.info("Generating coding summary for session:", interviewSessionId);
                try {
                    const summaryResponse = await fetch("/api/interviews/generate-coding-summary", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            sessionId: interviewSessionId,
                            finalCode: state.currentCode,
                            codingTask: interviewScript.codingPrompt,
                            expectedSolution: interviewScript.codingAnswer,
                        }),
                    });
                    
                    if (summaryResponse.ok) {
                        const summaryData = await summaryResponse.json();
                        logger.info("✅ Coding summary generated");
                    } else {
                        logger.error("Failed to generate coding summary:", summaryResponse.status);
                    }
                } catch (summaryError) {
                    logger.error("Error generating coding summary:", summaryError);
                }
            }
            setIsInterviewLoading(false);
            
            // OpenAI flow: say closing line and rely on response.done to end
            try {
                const ref = realTimeConversationRef.current;
                if (ref?.sayClosingLine && typeof ref.sayClosingLine === "function") {
                    await ref.sayClosingLine(candidateName);
                }
            } catch {}
            await setCodingState(false);
            setCodingStarted(false);
            setIsCodingStarted(false);
            stopTimer();
        } catch (error) {
            logger.error("❌ Failed to submit solution:", error);
        }
    }, [candidateName, insertRecordingUrl, interviewScript, interviewSessionId, setCodingStarted, setCodingState, state.currentCode, stateMachineHandleSubmission, stopRecording, stopTimer, updateSubmission]);

    /**
     * Starts the interview: begins recording, creates application/session, resets code, and connects to the agent.
     */
    const handleInterviewButtonClick = useCallback(async () => {
        try {
            setIsInterviewLoading(true);
            const recordingStarted = await startRecording();
            if (!recordingStarted) {
                setIsInterviewLoading(false);
                return;
            }

            const isDemoMode = searchParams.get("demo") === "true";
            const demoUserId = searchParams.get("userId");

            if (!applicationCreated && companyId) {
                try {
                    // Check if applicationId exists in URL params (from background-interview)
                    const existingApplicationId = searchParams.get("applicationId");

                    if (existingApplicationId) {
                        logger.info(`✅ Using existing application: ${existingApplicationId}`);
                        setApplicationCreated(true);
                        setApplicationId(existingApplicationId);
                        
                        // Always create a NEW session for the coding phase with fresh recording timestamp
                        const actualStartTime = getActualRecordingStartTime();
                        logger.info("📹 Creating NEW coding session with actual recording start time:", actualStartTime?.toISOString());
                        const session = await createInterviewSession({
                            applicationId: existingApplicationId,
                            companyId,
                            userId: isDemoMode ? demoUserId || undefined : undefined,
                            isDemoMode,
                            recordingStartedAt: actualStartTime || undefined,
                        });
                        const sessionId = session.interviewSession.id;
                        setInterviewSessionId(sessionId);
                        dispatch(setSessionId({ sessionId }));
                    } else {
                        // Create new application and session
                        const application = await createApplication({
                            companyId,
                            jobId,
                            userId: isDemoMode ? demoUserId || undefined : undefined,
                            isDemoMode,
                        });
                        setApplicationCreated(true);

                        if (application?.application?.id) {
                            setApplicationId(application.application.id);
                            const actualStartTime = getActualRecordingStartTime();
                            logger.info("📹 Creating session with actual recording start time:", actualStartTime?.toISOString());
                            const session = await createInterviewSession({
                                applicationId: application.application.id,
                                companyId,
                                userId: isDemoMode ? demoUserId || undefined : undefined,
                                isDemoMode,
                                recordingStartedAt: actualStartTime || undefined,
                            });
                            const sessionId = session.interviewSession.id;
                            setInterviewSessionId(sessionId);
                            dispatch(setSessionId({ sessionId }));
                        }
                    }
                } catch (error) {
                    logger.error(
                        "❌ Error creating application/interview session:",
                        error
                    );
                }
            }

            if (isTextMode) {
                setIsChatInputLocked(true);
            }
            
            updateCurrentCode(getInitialCode());
            window.postMessage({ type: "clear-chat" }, "*");
            
            // Start conversation first to load script, THEN force to coding
            await realTimeConversationRef.current?.startConversation();
            
            // Force state machine to coding stage (background handled separately)
            dispatch(forceCoding());
            interviewChatStore.dispatch({ type: "SET_STAGE", payload: "coding" } as any);
            logger.info("✅ State machine transitioned to coding stage");
            
            setIsInterviewActive(true);
            logger.info("Interview started successfully!");
        } catch (error) {
            logger.error("Failed to start interview:", error);
            setIsInterviewLoading(false);
        }
    }, [
        startRecording,
        applicationCreated,
        companyId,
        jobId,
        updateCurrentCode,
        setInterviewSessionId,
        isTextMode,
        setIsChatInputLocked,
    ]);

    /**
     * Auto-start interview when coming from demo page (one-time flag).
     */
    useEffect(() => {
        const shouldAutoStart = sessionStorage.getItem("sfinx-demo-autostart") === "true";
        if (shouldAutoStart && !autoStartTriggeredRef.current && !isInterviewActive && demoCandidateName) {
            autoStartTriggeredRef.current = true;
            sessionStorage.removeItem("sfinx-demo-autostart");
            logger.info("Auto-starting interview from demo flow");
            void handleInterviewButtonClick();
        }
    }, [isInterviewActive, demoCandidateName, handleInterviewButtonClick]);

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
                    try {
                        const interviewContent = data?.job?.interviewContent;
                        if (interviewContent) {
                            const codingSecondsRaw = Number(
                                interviewContent.codingQuestionTimeSeconds
                            );
                            const codingSeconds =
                                Number.isFinite(codingSecondsRaw) && codingSecondsRaw > 0
                                    ? Math.floor(codingSecondsRaw)
                                    : DEFAULT_CODING_DURATION_SECONDS;
                            setCodingDurationSeconds(codingSeconds);
                        } else {
                            setCodingDurationSeconds(DEFAULT_CODING_DURATION_SECONDS);
                        }
                        timeboxFiredRef.current = false;

                        const companyName = data?.job?.company?.name;
                        const companySlug = (companyName || "").toLowerCase();
                        const roleSlug = (data?.job?.title || "")
                            .toLowerCase()
                            .replace(/\s+/g, "-");
                        dispatch(
                            setCompanyContext({
                                companyName,
                                companySlug,
                                roleSlug,
                            })
                        );
                    } catch {}
                }
            })
            .catch(() => {});
        return () => {
            mounted = false;
        };
    }, [jobId, dispatch]);

    /**
     * Initializes editor content with the default snippet if empty.
     */
    useEffect(() => {
        // If no code yet, fetch the coding template once company/role are known
        (async () => {
            if (state.currentCode) return;
            if (!job) return; // wait until job is loaded and store context set
            const companyNameRaw = job?.company?.name;
            const roleTitleRaw = job?.title;
            if (!companyNameRaw || !roleTitleRaw) return;
            const companySlug = companyNameRaw.toLowerCase();
            const roleSlug = roleTitleRaw.toLowerCase().replace(/\s+/g, "-");
            const resp = await fetch(
                `/api/interviews/script?company=${companySlug}&role=${roleSlug}`
            );
            if (!resp.ok) {
                const detail =
                    (await resp.text().catch(() => "")) || resp.statusText;
                throw new Error(
                    `Failed to load interview script for ${companySlug}/${roleSlug}: ${detail}`
                );
            }
            const data = await resp.json();
            setInterviewScript(data); // Store script for iteration tracking
            const tmpl = String(data?.codingTemplate || "");
            if (tmpl.trim().length > 0) {
                updateCurrentCode(tmpl);
            }
        })().catch((error) => {
            logger.error("❌ Failed to load interview script:", error);
            throw error;
        });
    }, [state.currentCode, updateCurrentCode, job]);

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
            const isDemoMode = searchParams.get("demo") === "true";

            if (!onPracticePage) {
                const delay = typeof redirectDelayMs === "number" ? redirectDelayMs : 4000;
                setTimeout(() => {
                    try {
                        const destination = isDemoMode
                            ? `/demo/company-view?candidateId=${searchParams.get("userId")}&applicationId=${applicationId}`
                            : "/job-search";
                        window.location.href = destination;
                    } catch {
                        const destination = isDemoMode
                            ? `/demo/company-view?candidateId=${searchParams.get("userId")}&applicationId=${applicationId}`
                            : "/job-search";
                        router.push(destination as any);
                    }
                }, delay);
            }
        }
    }, [interviewConcluded, companyId, router, markCompanyApplied, redirectDelayMs, searchParams, interviewSessionId, applicationId]);

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
     * Updates editor code state when user edits.
     */
    const handleCodeChange = useCallback(
        (code: string) => {
            updateCurrentCode(code);
        },
        [updateCurrentCode]
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
                const url = isDemoMode
                    ? `/api/interviews/session/${interviewSessionId}/iterations?skip-auth=true`
                    : `/api/interviews/session/${interviewSessionId}/iterations`;

                // Use the Run Code click timestamp minus 1 second for video evidence
                const clickTime = runCodeClickTimeRef.current || new Date();
                const evidenceTimestamp = new Date(clickTime.getTime() - 1000); // 1 second before click

                logger.info("🎯 [ITERATION] Timestamp calculation:");
                logger.info("  - Run Code clicked at:", clickTime.toISOString());
                logger.info("  - Evidence timestamp (click - 1s):", evidenceTimestamp.toISOString());
                logger.info("  - Current time:", new Date().toISOString());

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

                if (isDemoMode && demoUserId) {
                    body.userId = demoUserId;
                }

                logger.info("💾 [ITERATION] Saving to DB:", {
                    url,
                    runCodeClickTime: clickTime.toISOString(),
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
                } else {
                    const errorText = await saveResponse.text();
                    logger.error("❌ [ITERATION] Failed to save iteration:", errorText);
                }
            } catch (error) {
                logger.error("❌ Error tracking iteration:", error);
            }
        },
        [interviewSessionId, interviewScript, isDemoMode, demoUserId]
    );

    /**
     * Switches to the preview tab, adding it if not present.
     */
    const handleRunCode = useCallback(() => {
        const clickTime = new Date();
        runCodeClickTimeRef.current = clickTime;
        
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

    return (
        <div className="h-screen flex flex-col bg-soft-white text-deep-slate dark:bg-gray-900 dark:text-white">
            <header className="border-b border-gray-200/30 dark:border-gray-700/30 bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl px-3 py-1">
                <div className="grid grid-cols-3 items-center max-w-8xl mx-auto">
                    <div className="flex items-center">
                        <h1 className="text-xl font-medium text-gray-900 dark:text-white tracking-tight">
                            Front-end Developer Interview
                        </h1>
                    </div>
                    <div className="flex justify-center items-center justify-self-center">
                        {companyLogo ? (
                            <div className="relative h-20 w-20">
                                <Image
                                    src={companyLogo}
                                    alt="Company Logo"
                                    fill
                                    sizes="80px"
                                    className="object-contain scale-125"
                                />
                            </div>
                        ) : null}
                    </div>
                    <div className="justify-self-end">
                        <HeaderControls
                            isCameraOn={isCameraOn}
                            onToggleCamera={toggleCamera}
                            isCodingStarted={isCodingStarted}
                            hasSubmitted={Boolean(state.hasSubmitted)}
                            timeLeft={timeLeft}
                            formatTime={formatTime}
                            automaticMode={automaticMode}
                            isInterviewActive={Boolean(isInterviewActive)}
                            onStartCoding={handleStartCoding}
                            onSubmit={handleSubmit}
                            isDebugModeEnabled={isDebugModeEnabled}
                            isDebugVisible={isDebugVisible}
                            onToggleDebug={toggleDebugPanel}
                            codingDurationSeconds={codingDurationSeconds}
                        />
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-hidden mt-6">
                <PanelGroup direction="horizontal">
                    <Panel defaultSize={70} minSize={50}>
                        <div className="h-full border-r bg-white border-light-gray dark:bg-gray-800 dark:border-gray-700 relative">
                            <EditorPanel
                                currentCode={state.currentCode}
                                onCodeChange={handleCodeChange}
                                availableTabs={availableTabs}
                                activeTab={activeTab}
                                onTabSwitch={handleTabSwitch}
                                onRunCode={handleRunCode}
                                readOnly={!isCodingStarted}
                                onElevenLabsUpdate={onElevenLabsUpdate}
                                updateKBVariables={updateKBVariables}
                                onPasteDetected={(pastedCode, timestamp) => {
                                    if (isTextMode) {
                                        try {
                                            const ref = realTimeConversationRef.current;
                                            if (ref?.handlePasteDetected) {
                                                ref.handlePasteDetected(pastedCode, timestamp);
                                            }
                                        } catch {}
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
                            />
                            <InterviewOverlay
                                isCodingStarted={isCodingStarted}
                                isInterviewActive={isInterviewActive}
                                isInterviewLoading={isInterviewLoading}
                                isAgentConnected={isAgentConnected}
                                interviewConcluded={interviewConcluded}
                                hasSubmitted={state.hasSubmitted}
                                candidateName={candidateName}
                            codingDurationSeconds={codingDurationSeconds}
                                onStartInterview={handleInterviewButtonClick}
                            />
                            <CameraPreview
                                isCameraOn={isCameraOn}
                                videoRef={selfVideoRef}
                            />
                        </div>
                    </Panel>

                    <PanelResizeHandle className="w-2 bg-light-gray hover:bg-electric-blue dark:bg-gray-600 dark:hover:bg-gray-500" />

                    <Panel defaultSize={30} minSize={25}>
                        <RightPanel
                            isInterviewActive={isInterviewActive}
                            candidateName={candidateName}
                            handleUserTranscript={handleUserTranscript}
                            updateKBVariables={updateKBVariables}
                            kbVariables={kbVariables}
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
                                    try {
                                        interviewChatStore.dispatch({
                                            type: "SET_STAGE",
                                            payload: "greeting",
                                        } as any);
                                    } catch {}
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
                            interviewSessionId={interviewSessionId}
                        />
                    </Panel>
                </PanelGroup>
            </div>
        </div>
    );
};

/**
 * Wrapper component that renders both the main content and debug panel
 */
const InterviewIDEWithDebug = () => {
    const isDebugModeEnabled = process.env.NEXT_PUBLIC_DEBUG_MODE === "true";
    const debugPanelVisibleEnv = process.env.NEXT_PUBLIC_DEBUG_PANEL_VISIBLE;
    const [isDebugVisible, setIsDebugVisible] = useState(() => {
        if (!isDebugModeEnabled) return false;
        if (debugPanelVisibleEnv === "true") return true;
        if (debugPanelVisibleEnv === "false") return false;
        return true;
    });
    const [evaluationDebugData, setEvaluationDebugData] = useState<any>(null);
    const [isEvaluationLoading, setIsEvaluationLoading] = useState(false);
    const [testEvaluationCallback, setTestEvaluationCallback] = useState<(() => void) | null>(null);
    
    const toggleDebugPanel = useCallback(() => {
        if (!isDebugModeEnabled) return;
        setIsDebugVisible((prev) => !prev);
    }, [isDebugModeEnabled]);
    
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
                setIsDebugVisible={setIsDebugVisible}
                evaluationDebugData={evaluationDebugData}
                setEvaluationDebugData={setEvaluationDebugData}
                isEvaluationLoading={isEvaluationLoading}
                setIsEvaluationLoading={setIsEvaluationLoading}
                toggleDebugPanel={toggleDebugPanel}
                isDebugModeEnabled={isDebugModeEnabled}
                onTestEvaluationReady={onTestEvaluationReady}
            />
            
            {/* Debug Panel - below IDE in document flow, scroll down to see it */}
            {isDebugVisible && isDebugModeEnabled && (
                <div className="w-full p-4">
                    <CodingEvaluationDebugPanel 
                        evaluationData={evaluationDebugData} 
                        isLoading={isEvaluationLoading}
                        onTestEvaluation={onTestEvaluation}
                    />
                </div>
            )}
        </div>
    );
};

/**
 * Root wrapper that provides interview context and renders the main content.
 */
const InterviewIDE = () => {
    return (
        <InterviewProvider>
            <InterviewIDEWithDebug />
        </InterviewProvider>
    );
};

export default InterviewIDE;
