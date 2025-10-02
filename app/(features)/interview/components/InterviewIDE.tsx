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
import { logger } from "../../../shared/services";
import { useCamera } from "./hooks/useCamera";
import { useScreenRecording } from "./hooks/useScreenRecording";
import { useInterviewTimer } from "./hooks/useInterviewTimer";
import { useThemePreference } from "./hooks/useThemePreference";
import { createApplication } from "./services/applicationService";
import { createInterviewSession } from "./services/interviewSessionService";
import { fetchJobById } from "./services/jobService";
import { applyCodeEditsSafely } from "../../../shared/services/applyCodeEdits";
import {
    computeHash,
    mintNextVersionId,
} from "../../../shared/services/versioning";
import { TTSQueue } from "../../../shared/services/ttsQueue";
// Local SpeechSynthesis for near-zero latency

const log = logger.for("@InterviewIDE.tsx");
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

const getInitialCode = () => DEFAULT_CODE;

type InterviewerMode = "ELEVEN_LABS" | "HUMAN";
type CandidateMode = "OPENAI" | "HUMAN";

interface InterviewerContentProps {
    interviewer?: InterviewerMode;
    candidate?: CandidateMode;
    candidateName?: string;
}

const InterviewerContent = ({
    interviewer = "ELEVEN_LABS",
    candidate = "HUMAN",
    candidateName: candidateNameProp,
}: InterviewerContentProps) => {
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
        candidateNameProp || (session?.user as any)?.name || "Candidate";

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
    const versionIdRef = useRef<string>("v1");
    const ttsRef = useRef<TTSQueue | null>(null);
    const recognitionRef = useRef<any>(null);
    const [isMicListening, setIsMicListening] = useState(false);
    const historyRef = useRef<
        Array<{ role?: "candidate" | "interviewer"; text: string }>
    >([]);
    const [applicationCreated, setApplicationCreated] = useState(false);
    const [interviewConcluded, setInterviewConcluded] = useState(false);
    const realTimeConversationRef = useRef<any>(null);
    const automaticMode = process.env.NEXT_PUBLIC_AUTOMATIC_MODE === "true";

    useThemePreference();

    // Force-enable detailed logging for this component (dev/training visibility)
    useEffect(() => {
        try {
            logger.setEnabled(true);
            logger.setLevels(["debug", "info", "warn", "error"] as any);
            logger.setModules(null);
            log.info("🪵 Logging enabled for InterviewIDE");
        } catch {}
    }, []);

    const { isCameraOn, selfVideoRef, toggleCamera } = useCamera();
    const {
        startRecording,
        stopRecording,
        interviewSessionId,
        setInterviewSessionId,
    } = useScreenRecording();

    useEffect(() => {
        log.info("🔄 interviewSessionId changed to:", interviewSessionId);
    }, [interviewSessionId]);

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

    const handleStartCoding = useCallback(async () => {
        setIsCodingStarted(true);
        setCodingStarted(true);
        await setCodingState(true);
        startTimer();
    }, [setCodingStarted, setCodingState, startTimer]);

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

    const handleInterviewButtonClick = useCallback(async () => {
        try {
            setIsInterviewLoading(true);
            log.info("▶️ Start Interview clicked", { interviewer, candidate });
            const recordingStarted = await startRecording();
            if (!recordingStarted) {
                setIsInterviewLoading(false);
                return;
            }

            // Skip application/session creation for training mode
            if (
                interviewer === "ELEVEN_LABS" &&
                !applicationCreated &&
                companyId
            ) {
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
            // Training mode: start timer and enable coding immediately after screen share approval
            if (interviewer === "HUMAN" && candidate === "OPENAI") {
                try {
                    setIsCodingStarted(true);
                    setCodingStarted(true);
                    await setCodingState(true);
                    startTimer();
                } catch (_) {}
            }
            // Start interviewer voice only when using ElevenLabs
            if (interviewer === "ELEVEN_LABS") {
                log.info("🎙️ Starting ElevenLabs conversation (interviewer)");
                await realTimeConversationRef.current?.startConversation();
            }
            // In training (candidate=OPENAI), mark candidate as connected for UI readiness
            if (candidate === "OPENAI") {
                setIsAgentConnected(true);
                log.info(
                    "✅ Candidate (OPENAI) marked connected; starting mic loop"
                );
                // Kick off mic transcript loop (human interviewer) → candidate TTS reply
                startHumanMicLoop();
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
        interviewer,
        candidate,
    ]);

    const toggleMicMute = useCallback(() => {
        if (realTimeConversationRef.current?.toggleMicMute) {
            realTimeConversationRef.current.toggleMicMute();
        }
    }, []);

    useEffect(() => {
        const onPracticePage =
            typeof window !== "undefined" &&
            window.location.pathname === "/practice";
        if (!companyId && !onPracticePage) {
            router.push("/job-search");
        }
    }, [companyId, router]);

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

    useEffect(() => {
        if (!state.currentCode) {
            updateCurrentCode(getInitialCode());
        }
    }, [state.currentCode, updateCurrentCode]);

    // Removed unused manual training send helper

    const startHumanMicLoop = useCallback(() => {
        if (interviewer !== "HUMAN" || candidate !== "OPENAI") return;
        if (typeof window === "undefined") return;
        // Browser STT (webkit prefix in Chrome)
        const SpeechRecognition: any =
            (window as any).SpeechRecognition ||
            (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            log.warn("SpeechRecognition not available in this browser");
            return;
        }
        if (!ttsRef.current) {
            ttsRef.current = new TTSQueue(
                (text: string) =>
                    new Promise<void>((resolve, reject) => {
                        try {
                            const u = new SpeechSynthesisUtterance(text);
                            u.onend = () => resolve();
                            u.onerror = (e) => reject(e);
                            window.speechSynthesis.speak(u);
                        } catch (e) {
                            reject(e);
                        }
                    })
            );
        }
        const recognition = new SpeechRecognition();
        recognition.lang = "en-US";
        recognition.continuous = true;
        recognition.interimResults = false;
        log.info("🎤 Starting HUMAN mic recognition loop");
        // Notify chat UI that recording is active
        try {
            window.postMessage(
                { type: "recording-status", isRecording: true },
                "*"
            );
        } catch {}
        recognition.onresult = async (event: any) => {
            try {
                const result = event.results[event.results.length - 1];
                if (!result) return;
                const transcript = result[0]?.transcript?.trim();
                if (!transcript) return;
                log.info("📝 Mic transcript", transcript);
                // Update rolling history (last 6 turns)
                historyRef.current.push({
                    role: "interviewer",
                    text: transcript,
                });
                historyRef.current = historyRef.current.slice(-12);
                // Emit user message to chat (same channel as normal flow)
                try {
                    window.postMessage(
                        {
                            type: "transcription",
                            text: transcript,
                            speaker: "user",
                            timestamp: new Date(),
                        },
                        "*"
                    );
                } catch {}
                // Pause mic while candidate speaks
                recognition.stop();
                setIsMicListening(false);
                try {
                    window.postMessage(
                        { type: "recording-status", isRecording: false },
                        "*"
                    );
                } catch {}
                log.info("📨 Sending transcript to candidate API");
                const res = await fetch("/api/candidate/respond", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        context: {
                            file: "training.tsx",
                            versionId: versionIdRef.current,
                            beforeHash: computeHash(state.currentCode),
                        },
                        history: historyRef.current,
                        controls: { allowCodeEdits: false },
                        transcript,
                    }),
                });
                const json = await res.json();
                const reply: string | undefined =
                    json?.respondWithCandidate?.text;
                if (reply) {
                    log.info("🔊 Candidate reply", reply);
                    historyRef.current.push({ role: "candidate", text: reply });
                    historyRef.current = historyRef.current.slice(-12);
                    // Emit AI message to chat
                    try {
                        window.postMessage(
                            {
                                type: "transcription",
                                text: reply,
                                speaker: "ai",
                                timestamp: new Date(),
                            },
                            "*"
                        );
                    } catch {}
                    await ttsRef.current!.speak(reply);
                }
            } catch (e) {
                log.warn("Mic loop error", e);
            } finally {
                // Resume listening
                try {
                    recognition.start();
                    setIsMicListening(true);
                    try {
                        window.postMessage(
                            { type: "recording-status", isRecording: true },
                            "*"
                        );
                    } catch {}
                } catch {}
            }
        };
        recognition.onend = () => {
            // Auto-restart if interview still active
            if (isInterviewActive) {
                try {
                    log.info("🔁 Mic recognition restarted");
                    recognition.start();
                    setIsMicListening(true);
                } catch {}
            }
        };
        recognitionRef.current = recognition;
        try {
            recognition.start();
            setIsMicListening(true);
        } catch {}
    }, [interviewer, candidate, state.currentCode, isInterviewActive]);

    useEffect(() => {
        return () => {
            try {
                recognitionRef.current?.stop?.();
            } catch {}
        };
    }, []);

    useEffect(() => {
        // Training integration: listen for externally posted code edits
        const handler = (event: MessageEvent) => {
            if (event.data?.type === "training-apply-edits") {
                const { edits } = event.data as {
                    edits: Array<{
                        file: string;
                        range: { start: number; end: number };
                        replacement: string;
                    }>;
                };
                const applyRes = applyCodeEditsSafely(state.currentCode, edits);
                if (applyRes.ok) {
                    updateCurrentCode(applyRes.text);
                    versionIdRef.current = mintNextVersionId(
                        versionIdRef.current
                    );
                    document.body.dataset.trainingApplied = "true";
                }
            }
        };
        window.addEventListener("message", handler);
        return () => window.removeEventListener("message", handler);
    }, [state.currentCode, updateCurrentCode]);

    useEffect(() => {
        const currentTask = getCurrentTask();
        if (currentTask?.id === "task1-userlist") {
            updateCurrentCode(getInitialCode());
        }
    }, [getCurrentTask, state.currentTaskId, updateCurrentCode]);

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

    const handleCodeChange = useCallback(
        (code: string) => {
            updateCurrentCode(code);
        },
        [updateCurrentCode]
    );

    const handleRunCode = useCallback(() => {
        if (!availableTabs.includes("preview")) {
            setAvailableTabs((tabs) => [...tabs, "preview"]);
        }
        setActiveTab("preview");
    }, [availableTabs]);

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
                            onStartConversation={() => {
                                log.info("Conversation started");
                                setIsInterviewLoading(false);
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
                        />
                    </Panel>
                </PanelGroup>
            </div>
        </div>
    );
};

const InterviewIDE = (props: InterviewerContentProps) => {
    return (
        <InterviewProvider>
            <InterviewerContent {...props} />
        </InterviewProvider>
    );
};

export default InterviewIDE;
