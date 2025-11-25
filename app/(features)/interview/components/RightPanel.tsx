"use client";

import React, { useEffect } from "react";
import Image from "next/image";
import OpenAIVoiceConversation from "./chat/OpenAIVoiceConversation";
import OpenAITextConversation from "./chat/OpenAITextConversation";
import ChatPanel from "./chat/ChatPanel";

interface RightPanelProps {
    isInterviewActive: boolean;
    candidateName: string;
    automaticMode: boolean;
    isCodingStarted: boolean;
    onAutoStartCoding: () => void;
    onStartConversation: () => void;
    onEndConversation: () => void;
    onInterviewConcluded: (delayMs?: number) => void;
    micMuted: boolean;
    onToggleMicMute: () => void;
    realTimeConversationRef: React.RefObject<any>;
    isAgentConnected: boolean;
    setIsAgentConnected: (v: boolean) => void;
    setIsInterviewActive: (v: boolean) => void;
    onStopTimer: () => void;
    isTextInputLocked: boolean;
    onCodingPromptReady?: () => void;
    onGreetingDelivered?: () => void;
    codingDurationSeconds: number;
    setInputLocked?: (locked: boolean) => void;
    onHighlightPastedCode?: (pastedCode: string) => void;
    interviewSessionId?: string | null;
    isDemoMode?: boolean;
    userId?: string;
}

const RightPanel: React.FC<RightPanelProps> = ({
    isInterviewActive,
    candidateName,
    onHighlightPastedCode,
    automaticMode,
    isCodingStarted,
    onAutoStartCoding,
    onStartConversation,
    onEndConversation,
    onInterviewConcluded,
    micMuted,
    onToggleMicMute,
    realTimeConversationRef,
    isAgentConnected,
    setIsAgentConnected,
    setIsInterviewActive,
    onStopTimer,
    isTextInputLocked,
    onCodingPromptReady,
    onGreetingDelivered,
    codingDurationSeconds,
    setInputLocked,
    interviewSessionId,
    isDemoMode,
    userId,
}) => {
    const commMethodRaw = (process.env.NEXT_PUBLIC_INTERVIEW_COMM_METHOD || "speech")
        .toLowerCase()
        .trim();
    const isTextMode =
        commMethodRaw === "text" ||
        commMethodRaw === "true" ||
        commMethodRaw === "1" ||
        commMethodRaw === "yes";

    return (
        <div className="h-full flex flex-col border-t">
            {/* Text mode - hidden conversation component for state management */}
            {isTextMode && (
                <div className="hidden">
                    <OpenAITextConversation
                        ref={realTimeConversationRef}
                        candidateName={candidateName}
                        onStartConversation={() => {
                            setIsAgentConnected(true);
                            onStartConversation();
                        }}
                        automaticMode={automaticMode}
                        onCodingPromptReady={() => {
                            onCodingPromptReady?.();
                            if (automaticMode) {
                                onAutoStartCoding();
                            }
                        }}
                        onGreetingDelivered={onGreetingDelivered}
                        onInterviewConcluded={(delayMs?: number) => {
                            try {
                                onInterviewConcluded(delayMs);
                            } catch {}
                        }}
                        setInputLocked={setInputLocked}
                        onHighlightPastedCode={onHighlightPastedCode}
                        interviewSessionId={interviewSessionId}
                        isDemoMode={isDemoMode}
                        userId={userId}
                    />
                </div>
            )}

            {/* Voice mode - show conversation area */}
            {!isTextMode && (
                <div className="flex-[1] flex flex-col bg-white dark:bg-gray-800 p-4">
                    <OpenAIVoiceConversation
                        ref={realTimeConversationRef}
                        isInterviewActive={isInterviewActive}
                        candidateName={candidateName}
                        automaticMode={automaticMode}
                        onAutoStartCoding={onAutoStartCoding}
                        onStartConversation={() => {
                            setIsAgentConnected(true);
                            onStartConversation();
                        }}
                        onEndConversation={() => {
                            try {
                                const ref = realTimeConversationRef as any;
                                if (ref?.current?.stopConversation) {
                                    ref.current.stopConversation();
                                }
                            } catch {}
                            setIsInterviewActive(false);
                            setIsAgentConnected(false);
                            onStopTimer();
                            onEndConversation();
                        }}
                        onInterviewConcluded={onInterviewConcluded}
                    />
                </div>
            )}


            <div className={`${isTextMode ? 'flex-1' : 'flex-[3]'} h-full overflow-hidden`}>
                <ChatPanel
                    micMuted={micMuted}
                    onToggleMicMute={onToggleMicMute}
                    onSendText={isTextMode ? async (t: string) => {
                        try {
                            const ref = realTimeConversationRef?.current as any;
                            if (ref?.sendUserMessage) {
                                await ref.sendUserMessage(t);
                            }
                        } catch {}
                    } : undefined}
                    isInputDisabled={isTextMode && isTextInputLocked}
                    isInterviewActive={isInterviewActive}
                    isAgentConnected={isAgentConnected}
                />
            </div>
        </div>
    );
};

export default RightPanel;
