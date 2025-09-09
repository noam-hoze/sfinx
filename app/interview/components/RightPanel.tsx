"use client";

import React from "react";
import RealTimeConversation from "./chat/RealTimeConversation";
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
    realTimeConversationRef: React.Ref<any>;
    isAgentConnected: boolean;
    setIsAgentConnected: (v: boolean) => void;
    setIsInterviewActive: (v: boolean) => void;
    timerInterval: NodeJS.Timeout | null;
    clearTimerInterval: () => void;
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
    timerInterval,
    clearTimerInterval,
}) => {
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
                                Carrey
                            </h3>
                        </div>
                    </div>
                </div>

                <div className="flex-1 p-4">
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
                            clearTimerInterval();
                            onEndConversation();
                        }}
                        onInterviewConcluded={onInterviewConcluded}
                    />
                </div>
            </div>

            <div className="flex-[3] h-full overflow-hidden">
                <ChatPanel
                    micMuted={micMuted}
                    onToggleMicMute={onToggleMicMute}
                />
            </div>
        </div>
    );
};

export default RightPanel;
