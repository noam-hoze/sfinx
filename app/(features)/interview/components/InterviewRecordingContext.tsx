"use client";

import React, { createContext, useContext, ReactNode } from "react";

/**
 * Supplies shared recording controls so the coding IDE can reuse the session
 * created during the interview start flow without re-requesting permissions.
 */
export type InterviewRecordingContextValue = {
    isRecording: boolean;
    recordingPermissionGranted: boolean;
    micPermissionGranted: boolean;
    recordingUrl: string | null;
    recordingUploaded: boolean;
    interviewSessionId: string | null;
    setInterviewSessionId: (sessionId: string | null) => void;
    startRecording: () => Promise<boolean>;
    stopRecording: () => Promise<void>;
    insertRecordingUrl: () => Promise<void>;
    requestRecordingPermission: () => Promise<boolean>;
    setRecordingPermissionGranted: (granted: boolean) => void;
    setMicPermissionGranted: (granted: boolean) => void;
    setRecordingUploaded: (uploaded: boolean) => void;
    mediaRecorderRef: React.MutableRefObject<MediaRecorder | null>;
    getActualRecordingStartTime: () => Date | null;
};

const InterviewRecordingContext =
    createContext<InterviewRecordingContextValue | null>(null);

/**
 * Provides shared recording state to interview children.
 */
export const InterviewRecordingProvider = ({
    value,
    children,
}: {
    value: InterviewRecordingContextValue;
    children: ReactNode;
}) => {
    return (
        <InterviewRecordingContext.Provider value={value}>
            {children}
        </InterviewRecordingContext.Provider>
    );
};

/**
 * Returns the shared recording state or throws if the provider is missing.
 */
export const useInterviewRecording = () => {
    const context = useContext(InterviewRecordingContext);
    if (!context) {
        throw new Error(
            "useInterviewRecording must be used within an InterviewRecordingProvider"
        );
    }

    return context;
};
