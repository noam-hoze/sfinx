"use client";

import React from "react";
import RealTimeConversation from "./chat/RealTimeConversation";
import OpenAIVoiceConversation from "./chat/OpenAIVoiceConversation";
import OpenAITextConversation from "./chat/OpenAITextConversation";
import ChatPanel from "./chat/ChatPanel";

interface RightPanelProps {
    isInterviewActive: boolean;
    candidateName: string;
    handleUserTranscript: (transcript: string) => Promise<void>;
    updateKBVariables: (updates: any) => Promise<void>;
    kbVariables: any;
    automaticMode: boolean;
    isCodingStarted: boolean;
    onAutoStartCoding: () => void;
    onStartConversation: () => void;
    onEndConversation: () => void;
    onInterviewConcluded: () => void;
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
}

const RightPanel: React.FC<RightPanelProps> = ({
    isInterviewActive,
    candidateName,
    handleUserTranscript,
    updateKBVariables,
    kbVariables,
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
}) => {
    const isTextMode = (process.env.NEXT_PUBLIC_INTERVIEW_COMM_METHOD || "speech").toLowerCase() === "text";

    return (
        <div className="h-full flex flex-col border-t">
            <div className="flex-[1] flex flex-col bg-white dark:bg-gray-800">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <div
                                className={`w-2 h-2 rounded-full ${
                                    isInterviewActive && isAgentConnected
                                        ? "bg-green-500"
                                        : "bg-red-500"
                                }`}
                            ></div>
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                                Carrie
                            </h3>
                        </div>
                        <div className="text-xs font-medium">
                            <span
                                className={
                                    isInterviewActive && isAgentConnected
                                        ? "text-green-600 dark:text-green-400"
                                        : "text-gray-500 dark:text-gray-400"
                                }
                            >
                                {isInterviewActive && isAgentConnected
                                    ? "connected"
                                    : "disconnected"}
                            </span>
                        </div>
                    </div>
                </div>

            <div className="flex-1 p-4">
                    {isTextMode ? (
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
                        />
                    ) : ( (process.env.NEXT_PUBLIC_VOICE_ENGINE || "elevenlabs") === "openai" ? (
                        <OpenAIVoiceConversation
                            ref={realTimeConversationRef}
                            isInterviewActive={isInterviewActive}
                            candidateName={candidateName}
                            handleUserTranscript={handleUserTranscript}
                            updateKBVariables={updateKBVariables}
                            kbVariables={kbVariables}
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
                        />) : (
                        <RealTimeConversation
                            ref={realTimeConversationRef}
                            isInterviewActive={isInterviewActive}
                            candidateName={candidateName}
                            handleUserTranscript={handleUserTranscript}
                            updateKBVariables={updateKBVariables}
                            kbVariables={kbVariables}
                            automaticMode={automaticMode}
                            onAutoStartCoding={onAutoStartCoding}
                            onStartConversation={() => {
                                setIsAgentConnected(true);
                                onStartConversation();
                            }}
                            onEndConversation={() => {
                                setIsInterviewActive(false);
                                setIsAgentConnected(false);
                                onStopTimer();
                                onEndConversation();
                            }}
                            onInterviewConcluded={onInterviewConcluded}
                        />))}
                </div>
            </div>

            <div className="flex-[3] h-full overflow-hidden">
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
                />
            </div>
        </div>
    );
};

export default RightPanel;
