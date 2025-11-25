"use client";

import React from "react";
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
    return (
        <div className="h-full flex flex-col border-t">
            {/* Hidden conversation component for state management */}
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

            <div className="flex-1 h-full overflow-hidden">
                <ChatPanel
                    micMuted={micMuted}
                    onToggleMicMute={onToggleMicMute}
                    onSendText={async (t: string) => {
                        try {
                            const ref = realTimeConversationRef?.current as any;
                            if (ref?.sendUserMessage) {
                                await ref.sendUserMessage(t);
                            }
                        } catch {}
                    }}
                    isInputDisabled={isTextInputLocked}
                    isInterviewActive={isInterviewActive}
                    isAgentConnected={isAgentConnected}
                />
            </div>
        </div>
    );
};

export default RightPanel;
