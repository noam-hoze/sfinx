"use client";

import React, {
    createContext,
    useContext,
    useReducer,
    ReactNode,
    useEffect,
} from "react";
import { useSession } from "next-auth/react";
import { log } from "app/shared/services";

interface JobApplicationState {
    appliedCompanies: string[]; // Array of company IDs
    loading: boolean;
}

interface JobApplicationAction {
    type: "MARK_APPLIED" | "LOAD_FROM_DATABASE" | "SET_LOADING";
    payload?: string | string[];
}

const initialState: JobApplicationState = {
    appliedCompanies: [],
    loading: true,
};

function jobApplicationReducer(
    state: JobApplicationState,
    action: JobApplicationAction
): JobApplicationState {
    switch (action.type) {
        case "MARK_APPLIED":
            if (
                action.payload &&
                typeof action.payload === "string" &&
                !state.appliedCompanies.includes(action.payload)
            ) {
                return {
                    ...state,
                    appliedCompanies: [
                        ...state.appliedCompanies,
                        action.payload,
                    ],
                };
            }
            return state;

        case "LOAD_FROM_DATABASE":
            if (Array.isArray(action.payload)) {
                return {
                    ...state,
                    appliedCompanies: action.payload,
                    loading: false,
                };
            }
            return state;

        case "SET_LOADING":
            return {
                ...state,
                loading: true,
            };

        default:
            return state;
    }
}

const JobApplicationContext = createContext<{
    state: JobApplicationState;
    markCompanyApplied: (companyId: string) => void;
    isCompanyApplied: (companyId: string) => boolean;
} | null>(null);

export function JobApplicationProvider({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(jobApplicationReducer, initialState);
    const { data: session, status } = useSession();

    // Load applied companies from database when user is authenticated
    useEffect(() => {
        const fetchAppliedCompanies = async () => {
            // Only fetch if user is authenticated
            if (status === "authenticated" && session?.user) {
                try {
                    const response = await fetch("/api/user/applications");
                    if (response.ok) {
                        const data = await response.json();
                        dispatch({
                            type: "LOAD_FROM_DATABASE",
                            payload: data.appliedCompanyIds,
                        });
                    } else {
                        log.error("Failed to fetch applied companies");
                        dispatch({ type: "LOAD_FROM_DATABASE", payload: [] });
                    }
                } catch (error) {
                    log.error("Error fetching applied companies:", error);
                    dispatch({ type: "LOAD_FROM_DATABASE", payload: [] });
                }
            } else if (status === "unauthenticated") {
                // Clear data when user logs out
                dispatch({ type: "LOAD_FROM_DATABASE", payload: [] });
            }
            // If status is "loading", do nothing - wait for authentication status
        };

        fetchAppliedCompanies();
    }, [session, status]);

    const markCompanyApplied = (companyId: string) => {
        dispatch({ type: "MARK_APPLIED", payload: companyId });
    };

    const isCompanyApplied = (companyId: string) => {
        return state.appliedCompanies.includes(companyId);
    };

    return (
        <JobApplicationContext.Provider
            value={{ state, markCompanyApplied, isCompanyApplied }}
        >
            {children}
        </JobApplicationContext.Provider>
    );
}

export function useJobApplication() {
    const context = useContext(JobApplicationContext);
    if (!context) {
        throw new Error(
            "useJobApplication must be used within a JobApplicationProvider"
        );
    }
    return context;
}
