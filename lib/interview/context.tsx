"use client";

import React, { createContext, useContext, useReducer, ReactNode } from "react";
import {
    InterviewState,
    InterviewMessage,
    InterviewTask,
    GAL_TASKS,
} from "./types";

interface InterviewAction {
    type: string;
    payload?: any;
}

const initialState: InterviewState = {
    currentTaskId: null,
    tasks: GAL_TASKS,
    isActive: false,
    candidateName: "Gal",
    startTime: null,
    endTime: null,
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

    return {
        state,
        startInterview,
        endInterview,
        nextTask,
        updateTaskStatus,
        getCurrentTask,
    };
}
