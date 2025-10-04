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
import type { RoleConfig } from "../../../shared/contexts/types";
import {
    InterviewProvider,
    useInterview,
    useJobApplication,
} from "../../../shared/contexts";
import {
    useElevenLabsAsInterviewer,
    useElevenLabsAsCandidate,
} from "../../../shared/hooks";
import { logger } from "../../../shared/services";
import { useCamera } from "./hooks/useCamera";
import { useScreenRecording } from "./hooks/useScreenRecording";
import { useInterviewTimer } from "./hooks/useInterviewTimer";
import { useThemePreference } from "./hooks/useThemePreference";
import { createApplication } from "./services/applicationService";
import { createInterviewSession } from "./services/interviewSessionService";
import { fetchJobById } from "./services/jobService";

const log = logger.for("@InterviewIDE.tsx");
if (typeof window !== "undefined") {
    logger.setEnabled(true);
    logger.setNamespacedOnly(true);
    logger.setModules([
        "@RealTimeConversation.tsx",
        "@InterviewIDE.tsx",
        "@clientTools.ts",
        "@OpenAITextConversation.tsx",
        "@useOpenAiAsCandidate.ts",
        "@RightPanel.tsx",
    ]);
    logger.setLevels(["debug", "info", "warn", "error"]);
}
const INTERVIEW_DURATION_SECONDS = 30 * 60;
const DEFAULT_CODE = `// Welcome to your coding interview!
// Create a UserList component that fetches users from an API

const UserList = () => {
    // Fetch users from: https://jsonplaceholder.typicode.com/users
    // Display name and email for each user
    // Add loading and error states

    return (
        <div>
            <h2>User List</h2>
            {/* Implement your user list here */}
        </div>
    );
};

render(UserList);`;

/**
 * Returns the initial code template displayed in the editor when the interview starts.
 */
const getInitialCode = () => DEFAULT_CODE;

/**
 * Main interview container: orchestrates UI state, timers, recording,
 * and the ElevenLabs-driven state machine for conversation and coding flow.
 */
const InterviewerContent = ({
    candidateNameOverride,
    roles: rolesProp,
}: {
    candidateNameOverride?: string;
    roles?: RoleConfig;
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
    const [job, setJob] = useState<any | null>(null);
    const candidateName =
        candidateNameOverride || (session?.user as any)?.name || "Candidate";

    /**
     * Queues a contextual knowledge-base update for the agent (non-blocking).
     */
    const onElevenLabsUpdate = useCallback(
        async (text: string) => {
            try {
                queueContextUpdate(text);
                log.info("✅ Queued ElevenLabs KB update:", text);
            } catch (error) {
                log.error("❌ Failed to queue ElevenLabs update:", error);
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
                log.info("✅ Queued user message:", message);
                return true;
            } catch (error) {
                log.error("❌ Failed to queue user message:", error);
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
    } = useElevenLabsAsInterviewer(
        onElevenLabsUpdate,
        onSendUserMessage,
        candidateName
    );

    const candidateHook = useElevenLabsAsCandidate(
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
    const [recordingEnabled, setRecordingEnabled] = useState(false);
    const [applicationCreated, setApplicationCreated] = useState(false);
    const [interviewConcluded, setInterviewConcluded] = useState(false);
    const realTimeConversationRef = useRef<any>(null);
    const automaticMode = process.env.NEXT_PUBLIC_AUTOMATIC_MODE === "true";
    const roles: RoleConfig = rolesProp || {
        interviewer: "elevenLabs",
        candidate: "human",
    };

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
        log.info("🔄 interviewSessionId changed to:", interviewSessionId);
    }, [interviewSessionId]);

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
            log.info("✅ Special 'I'm done' message queued successfully");
            return true;
        } catch (error) {
            log.error("❌ Error sending 'I'm done' message:", error);
            return false;
        }
    }, [queueUserMessage]);

    const { timeLeft, isTimerRunning, startTimer, stopTimer, formatTime } =
        useInterviewTimer({
            durationSeconds: INTERVIEW_DURATION_SECONDS,
            onExpire: async () => {
                log.info("⏰ Timer expired - ending interview...");
                updateSubmission(state.currentCode);
                await stopRecording();
                await stateMachineHandleSubmission(state.currentCode);
                await sendHiddenDoneMessage();
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

    /**
     * Submits the current solution, stops recording, exits coding mode, and stops the timer.
     */
    const handleSubmit = useCallback(async () => {
        try {
            updateSubmission(state.currentCode);
            await stopRecording();
            await stateMachineHandleSubmission(state.currentCode);
            await sendHiddenDoneMessage();
            await setCodingState(false);
            setCodingStarted(false);
            setIsCodingStarted(false);
            stopTimer();
        } catch (error) {
            log.error("❌ Failed to submit solution:", error);
        }
    }, [
        state.currentCode,
        stopRecording,
        stateMachineHandleSubmission,
        sendHiddenDoneMessage,
        setCodingState,
        setCodingStarted,
        stopTimer,
    ]);

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
                        setInterviewSessionId(session.interviewSession.id);
                    }
                } catch (error) {
                    log.error(
                        "❌ Error creating application/interview session:",
                        error
                    );
                }
            }

            updateCurrentCode(getInitialCode());
            window.postMessage({ type: "clear-chat" }, "*");
            // Before starting conversation, if candidate is ElevenLabs, register client tools
            if (roles.candidate === "elevenLabs") {
                try {
                    const tools = candidateHook.getClientTools(
                        () => state.currentCode,
                        (code: string) => updateCurrentCode(code)
                    );
                    // Pre-register tools immediately to avoid early tool-call races
                    try {
                        const conv: any = realTimeConversationRef.current;
                        log.info("RTC pre-register: APIs present", {
                            hasSet: typeof conv?.setClientTools === "function",
                            hasRegister:
                                typeof conv?.registerClientTool === "function",
                            hasAdd: typeof conv?.addClientTool === "function",
                        });
                        conv?.setClientTools?.(tools);
                        log.info(
                            "🔧 Pre-registered client tools before session start",
                            { toolNames: Object.keys(tools) }
                        );
                    } catch (_) {}
                    await realTimeConversationRef.current?.startConversation();
                    const registered = await (
                        candidateHook as any
                    ).registerClientTools?.(
                        realTimeConversationRef.current,
                        tools
                    );
                    log.info("RTC post-connect tool registration result", {
                        registered,
                    });
                } catch (_) {
                    // ignore registration errors; session will still start
                }
            } else {
                await realTimeConversationRef.current?.startConversation();
            }
            setIsInterviewActive(true);
            log.info("🎉 Interview started successfully!");
        } catch (error) {
            log.error("Failed to start interview:", error);
            setIsInterviewLoading(false);
        }
    }, [
        startRecording,
        applicationCreated,
        companyId,
        jobId,
        updateCurrentCode,
        setInterviewSessionId,
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
                }
            })
            .catch(() => {});
        return () => {
            mounted = false;
        };
    }, [jobId]);

    /**
     * Initializes editor content with the default snippet if empty.
     */
    useEffect(() => {
        if (!state.currentCode) {
            updateCurrentCode(getInitialCode());
        }
    }, [state.currentCode, updateCurrentCode]);

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
                log.info("✅ Interview completed successfully");
            } catch (error) {
                log.error("❌ Error handling interview conclusion:", error);
            }

            const onPracticePage =
                typeof window !== "undefined" &&
                window.location.pathname === "/practice";
            if (!onPracticePage) {
                setTimeout(() => {
                    router.push("/job-search");
                }, 2000);
            }
        }
    }, [interviewConcluded, companyId, router, markCompanyApplied]);

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

    const companyLogo = useMemo(
        () => job?.company?.logo || "/logos/meta-logo.png",
        [job]
    );

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
                        <div className="relative h-20 w-20">
                            <Image
                                src={companyLogo}
                                alt="Company Logo"
                                fill
                                sizes="80px"
                                className="object-contain scale-125"
                            />
                        </div>
                    </div>
                    <div className="justify-self-end">
                        <HeaderControls
                            isCameraOn={isCameraOn}
                            onToggleCamera={toggleCamera}
                            isCodingStarted={isCodingStarted}
                            timeLeft={timeLeft}
                            formatTime={formatTime}
                            automaticMode={automaticMode}
                            isInterviewActive={isInterviewActive}
                            onStartCoding={handleStartCoding}
                            onSubmit={handleSubmit}
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
                            />
                            <InterviewOverlay
                                isCodingStarted={isCodingStarted}
                                isInterviewActive={isInterviewActive}
                                isInterviewLoading={isInterviewLoading}
                                isAgentConnected={isAgentConnected}
                                interviewConcluded={interviewConcluded}
                                hasSubmitted={state.hasSubmitted}
                                candidateName={candidateName}
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
                            roles={roles}
                            isInterviewActive={isInterviewActive}
                            candidateName={candidateName}
                            handleUserTranscript={handleUserTranscript}
                            updateKBVariables={updateKBVariables}
                            kbVariables={kbVariables}
                            automaticMode={automaticMode}
                            isCodingStarted={isCodingStarted}
                            onAutoStartCoding={() => {
                                if (!isCodingStarted) {
                                    void handleStartCoding();
                                }
                            }}
                            onStartConversation={async () => {
                                log.info("Conversation started");
                                log.info(
                                    "Engine:",
                                    process.env.NEXT_PUBLIC_CANDIDATE_ENGINE
                                );
                                setIsInterviewLoading(false);
                                if (roles.candidate === "elevenLabs") {
                                    try {
                                        const tools =
                                            candidateHook.getClientTools(
                                                () => state.currentCode,
                                                (code: string) =>
                                                    updateCurrentCode(code)
                                            );
                                        const conv: any =
                                            realTimeConversationRef.current;
                                        log.info(
                                            "RTC onConnect: APIs present",
                                            {
                                                status: (conv as any)?.status,
                                                hasSet:
                                                    typeof conv?.setClientTools ===
                                                    "function",
                                                hasRegister:
                                                    typeof conv?.registerClientTool ===
                                                    "function",
                                                hasAdd:
                                                    typeof conv?.addClientTool ===
                                                    "function",
                                            }
                                        );
                                        const registered = await (
                                            candidateHook as any
                                        ).registerClientTools?.(
                                            realTimeConversationRef.current,
                                            tools
                                        );
                                        log.info(
                                            "RTC onConnect: tool registration result",
                                            { registered }
                                        );
                                        log.info(
                                            "🔧 Client tools registered on connect"
                                        );
                                    } catch (_) {}
                                }
                            }}
                            onEndConversation={() => {
                                log.info("Conversation ended");
                                stopTimer();
                                setIsCodingStarted(false);
                                setCodingStarted(false);
                                setIsInterviewLoading(false);
                            }}
                            onInterviewConcluded={() =>
                                setInterviewConcluded(true)
                            }
                            micMuted={micMuted}
                            onToggleMicMute={toggleMicMute}
                            realTimeConversationRef={realTimeConversationRef}
                            isAgentConnected={isAgentConnected}
                            setIsAgentConnected={setIsAgentConnected}
                            setIsInterviewActive={setIsInterviewActive}
                            onStopTimer={stopTimer}
                            recordingEnabled={recordingEnabled}
                            onToggleRecording={() =>
                                setRecordingEnabled((v) => !v)
                            }
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
type InterviewIDEProps = {
    candidateNameOverride?: string;
    roles?: RoleConfig;
};

const InterviewIDE = ({ candidateNameOverride, roles }: InterviewIDEProps) => {
    return (
        <InterviewProvider>
            <InterviewerContent
                candidateNameOverride={candidateNameOverride}
                roles={roles}
            />
        </InterviewProvider>
    );
};

export default InterviewIDE;
