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
import BackgroundDebugPanel from "../../../shared/components/BackgroundDebugPanel";
import { interviewChatStore } from "@/shared/state/interviewChatStore";
import { store } from "@/shared/state/store";

const logger = log;
const DEFAULT_BACKGROUND_DURATION_SECONDS = 15 * 60;
const DEFAULT_CODING_DURATION_SECONDS = 30 * 60;
const DEFAULT_CODE = ``;

/**
 * Returns the initial code template displayed in the editor when the interview starts.
 */
const getInitialCode = () => DEFAULT_CODE;

/**
 * Main interview container: orchestrates UI state, timers, recording,
 * and the ElevenLabs-driven state machine for conversation and coding flow.
 */
const InterviewerContent = () => {
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
    const [backgroundDurationSeconds, setBackgroundDurationSeconds] = useState(
        DEFAULT_BACKGROUND_DURATION_SECONDS
    );
    const [codingDurationSeconds, setCodingDurationSeconds] = useState(
        DEFAULT_CODING_DURATION_SECONDS
    );
    const backgroundDurationMs = useMemo(
        () => backgroundDurationSeconds * 1000,
        [backgroundDurationSeconds]
    );
    const candidateName = (session?.user as any)?.name || "Candidate";

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

    useEffect(() => {
        if (!Number.isFinite(backgroundDurationMs) || backgroundDurationMs <= 0) {
            return;
        }
        interviewChatStore.dispatch({
            type: "BG_GUARD_SET_TIMEBOX",
            payload: { timeboxMs: backgroundDurationMs },
        } as any);
    }, [backgroundDurationMs]);
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
    const isDebugModeEnabled = process.env.NEXT_PUBLIC_DEBUG_MODE === "true";
    const debugPanelVisibleEnv = process.env.NEXT_PUBLIC_DEBUG_PANEL_VISIBLE;
    const [isDebugVisible, setIsDebugVisible] = useState(() => {
        if (!isDebugModeEnabled) return false;
        if (debugPanelVisibleEnv === "true") return true;
        if (debugPanelVisibleEnv === "false") return false;
        return true;
    });
    const timeboxFiredRef = useRef(false);

    const toggleDebugPanel = useCallback(() => {
        if (!isDebugModeEnabled) return;
        setIsDebugVisible((prev) => !prev);
    }, [isDebugModeEnabled]);

    useThemePreference();

    const { isCameraOn, selfVideoRef, toggleCamera } = useCamera();
    const {
        startRecording,
        stopRecording,
        interviewSessionId,
        setInterviewSessionId,
    } = useScreenRecording();

    /**
     * Logs whenever the interview session ID changes (useful for tracing recording sessions).
     */
    useEffect(() => {
        logger.info("interviewSessionId changed to:", interviewSessionId);
    }, [interviewSessionId]);

    useEffect(() => {
        if (!Number.isFinite(backgroundDurationMs) || backgroundDurationMs <= 0) {
            return;
        }
        const id = setInterval(() => {
            if (timeboxFiredRef.current) return;
            try {
                const chatState = interviewChatStore.getState();
                const machineState = store.getState().interviewMachine?.state;
                const bg = chatState.background || {};
                const startedAtMs = bg.startedAtMs;
                if (!startedAtMs) return;
                if (machineState === "in_coding_session" || chatState.stage === "coding") {
                    timeboxFiredRef.current = true;
                    clearInterval(id);
                    return;
                }
                const elapsed = Date.now() - startedAtMs;
                if (elapsed >= backgroundDurationMs) {
                    timeboxFiredRef.current = true;
                    interviewChatStore.dispatch({ type: "BG_GUARD_SET_REASON", payload: { reason: "timebox" } });
                    store.dispatch(forceCoding());
                    interviewChatStore.dispatch({ type: "SET_STAGE", payload: "coding" } as any);
                    clearInterval(id);
                }
            } catch {}
        }, 500);
        return () => clearInterval(id);
    }, [backgroundDurationMs]);

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
     * Submits the current solution, stops recording, exits coding mode, and stops the timer.
     */
    const handleSubmit = useCallback(async () => {
        try {
            updateSubmission(state.currentCode);
            await stopRecording();
            await stateMachineHandleSubmission(state.currentCode);
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
    }, [candidateName, setCodingStarted, setCodingState, state.currentCode, stateMachineHandleSubmission, stopRecording, stopTimer, updateSubmission]);

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

            if (!applicationCreated && companyId) {
                try {
                    const application = await createApplication({
                        companyId,
                        jobId,
                    });
                    setApplicationCreated(true);

                    if (application?.application?.id) {
                        const session = await createInterviewSession({
                            applicationId: application.application.id,
                            companyId,
                        });
                        const sessionId = session.interviewSession.id;
                        setInterviewSessionId(sessionId);
                        dispatch(setSessionId({ sessionId }));
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
            await realTimeConversationRef.current?.startConversation();
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
                            const backgroundSecondsRaw = Number(
                                interviewContent.backgroundQuestionTimeSeconds
                            );
                            const codingSecondsRaw = Number(
                                interviewContent.codingQuestionTimeSeconds
                            );
                            const backgroundSeconds =
                                Number.isFinite(backgroundSecondsRaw) && backgroundSecondsRaw > 0
                                    ? Math.floor(backgroundSecondsRaw)
                                    : DEFAULT_BACKGROUND_DURATION_SECONDS;
                            const codingSeconds =
                                Number.isFinite(codingSecondsRaw) && codingSecondsRaw > 0
                                    ? Math.floor(codingSecondsRaw)
                                    : DEFAULT_CODING_DURATION_SECONDS;
                            setBackgroundDurationSeconds(backgroundSeconds);
                            setCodingDurationSeconds(codingSeconds);
                        } else {
                            setBackgroundDurationSeconds(DEFAULT_BACKGROUND_DURATION_SECONDS);
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
     * After interview concludes, mark application as applied and optionally redirect to job search.
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
                        window.location.href = "/job-search";
                    } catch {
                        router.push("/job-search");
                    }
                }, delay);
            }
        }
    }, [interviewConcluded, companyId, router, markCompanyApplied, redirectDelayMs]);

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
     * Switches to the preview tab, adding it if not present.
     */
    const handleRunCode = useCallback(() => {
        if (!availableTabs.includes("preview")) {
            setAvailableTabs((tabs) => [...tabs, "preview"]);
        }
        setActiveTab("preview");
    }, [availableTabs]);

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
                            {isDebugModeEnabled && (
                                <div
                                    className={`absolute top-4 left-1/2 z-30 w-full px-4 sm:px-6 md:px-8 lg:px-12 transform -translate-x-1/2 transition-all duration-300 ease-out ${
                                        isDebugVisible
                                            ? "opacity-100 translate-y-0 pointer-events-auto"
                                            : "opacity-0 -translate-y-2 pointer-events-none"
                                    }`}
                                >
                                    <div className="mx-auto max-w-3xl">
                                        <div className="debug-panel-scroll scroll-smooth max-h-[calc(100vh-160px)] overflow-y-auto pr-2 pb-2">
                                            <BackgroundDebugPanel timeboxMs={backgroundDurationMs} />
                                        </div>
                                    </div>
                                </div>
                            )}
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
                            />
                            <InterviewOverlay
                                isCodingStarted={isCodingStarted}
                                isInterviewActive={isInterviewActive}
                                isInterviewLoading={isInterviewLoading}
                                isAgentConnected={isAgentConnected}
                                interviewConcluded={interviewConcluded}
                                hasSubmitted={state.hasSubmitted}
                                candidateName={candidateName}
                            backgroundDurationSeconds={backgroundDurationSeconds}
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
                            backgroundDurationSeconds={backgroundDurationSeconds}
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
                        />
                    </Panel>
                </PanelGroup>
            </div>
        </div>
    );
};

/**
 * Root wrapper that provides interview context and renders the main content.
 */
const InterviewIDE = () => {
    return (
        <InterviewProvider>
            <InterviewerContent />
        </InterviewProvider>
    );
};

export default InterviewIDE;
