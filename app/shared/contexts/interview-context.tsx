"use client";

import React, { createContext, useContext, useReducer, ReactNode } from "react";
import {
    InterviewState,
    InterviewMessage,
    InterviewTask,
    NOAM_TASKS,
} from "./types";

interface InterviewAction {
    type: string;
    payload?: any;
}

const initialState: InterviewState = {
    currentTaskId: null,
    tasks: NOAM_TASKS,
    isActive: false,
    candidateName: "Noam",
    startTime: null,
    endTime: null,
    // Editor state
    currentCode: "",
    // Submission state
    submission: null,
    // Conversation coordination (refactor support)
    isCodingStarted: false,
    hasSubmitted: false,
    contextUpdatesQueue: [],
    userMessagesQueue: [],
};

function interviewReducer(
    state: InterviewState,
    action: InterviewAction
): InterviewState {
    switch (action.type) {
        case "START_INTERVIEW":
            return {
                ...state,
                isActive: true,
                startTime: new Date(),
                currentTaskId: state.tasks[0]?.id || null,
            };

        case "END_INTERVIEW":
            return {
                ...state,
                isActive: false,
                endTime: new Date(),
            };

        case "NEXT_TASK":
            const currentIndex = state.tasks.findIndex(
                (task) => task.id === state.currentTaskId
            );
            const nextIndex = currentIndex + 1;
            return {
                ...state,
                currentTaskId:
                    nextIndex < state.tasks.length
                        ? state.tasks[nextIndex].id
                        : null,
            };

        case "UPDATE_TASK_STATUS":
            return {
                ...state,
                tasks: state.tasks.map((task) =>
                    task.id === action.payload.taskId
                        ? {
                              ...task,
                              [action.payload.status]: true,
                              completed:
                                  action.payload.status === "completed"
                                      ? true
                                      : task.completed,
                          }
                        : task
                ),
            };

        case "UPDATE_CURRENT_CODE":
            return {
                ...state,
                currentCode: action.payload,
            };

        case "UPDATE_SUBMISSION":
            return {
                ...state,
                submission: action.payload,
                hasSubmitted: true,
            };

        case "SET_CODING_STARTED":
            return {
                ...state,
                isCodingStarted: action.payload === true,
            };

        case "QUEUE_CONTEXT_UPDATE":
            return {
                ...state,
                contextUpdatesQueue: [
                    ...(state.contextUpdatesQueue || []),
                    action.payload,
                ],
            };

        case "CLEAR_CONTEXT_UPDATES":
            return {
                ...state,
                contextUpdatesQueue: [],
            };

        case "QUEUE_USER_MESSAGE":
            return {
                ...state,
                userMessagesQueue: [
                    ...(state.userMessagesQueue || []),
                    action.payload,
                ],
            };

        case "CLEAR_USER_MESSAGES":
            return {
                ...state,
                userMessagesQueue: [],
            };

        default:
            return state;
    }
}

const InterviewContext = createContext<{
    state: InterviewState;
    dispatch: React.Dispatch<InterviewAction>;
} | null>(null);

export function InterviewProvider({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(interviewReducer, initialState);

    return (
        <InterviewContext.Provider value={{ state, dispatch }}>
            {children}
        </InterviewContext.Provider>
    );
}

export function useInterview() {
    const context = useContext(InterviewContext);
    if (!context) {
        throw new Error(
            "useInterview must be used within an InterviewProvider"
        );
    }

    const { state, dispatch } = context;

    const startInterview = () => {
        dispatch({ type: "START_INTERVIEW" });
    };

    const endInterview = () => {
        dispatch({ type: "END_INTERVIEW" });
    };

    const nextTask = () => {
        dispatch({ type: "NEXT_TASK" });
    };

    const updateTaskStatus = (
        taskId: string,
        status: "started" | "completed"
    ) => {
        dispatch({ type: "UPDATE_TASK_STATUS", payload: { taskId, status } });
    };

    const getCurrentTask = (): InterviewTask | null => {
        return (
            state.tasks.find((task) => task.id === state.currentTaskId) || null
        );
    };

    const updateCurrentCode = (code: string) => {
        dispatch({ type: "UPDATE_CURRENT_CODE", payload: code });
    };

    const updateSubmission = (code: string) => {
        dispatch({ type: "UPDATE_SUBMISSION", payload: code });
    };

    // New helpers for refactor support
    const setCodingStarted = (started: boolean) => {
        dispatch({ type: "SET_CODING_STARTED", payload: started });
    };

    const queueContextUpdate = (text: string) => {
        dispatch({ type: "QUEUE_CONTEXT_UPDATE", payload: text });
    };

    const clearContextUpdates = () => {
        dispatch({ type: "CLEAR_CONTEXT_UPDATES" });
    };

    const queueUserMessage = (text: string) => {
        dispatch({ type: "QUEUE_USER_MESSAGE", payload: text });
    };

    const clearUserMessages = () => {
        dispatch({ type: "CLEAR_USER_MESSAGES" });
    };

    return {
        state,
        startInterview,
        endInterview,
        nextTask,
        updateTaskStatus,
        getCurrentTask,
        updateCurrentCode,
        updateSubmission,
        setCodingStarted,
        queueContextUpdate,
        clearContextUpdates,
        queueUserMessage,
        clearUserMessages,
    };
}
