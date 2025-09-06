"use client";

import React, {
    createContext,
    useContext,
    useReducer,
    ReactNode,
    useEffect,
} from "react";

interface JobApplicationState {
    appliedCompanies: string[]; // Array of company IDs
}

interface JobApplicationAction {
    type: "MARK_APPLIED" | "LOAD_FROM_STORAGE";
    payload?: string;
}

const initialState: JobApplicationState = {
    appliedCompanies: [],
};

function jobApplicationReducer(
    state: JobApplicationState,
    action: JobApplicationAction
): JobApplicationState {
    switch (action.type) {
        case "MARK_APPLIED":
            if (
                action.payload &&
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

        case "LOAD_FROM_STORAGE":
            const stored = localStorage.getItem("sfinx-applied-companies");
            if (stored) {
                try {
                    const appliedCompanies = JSON.parse(stored);
                    return { appliedCompanies };
                } catch (error) {
                    console.error(
                        "Failed to parse applied companies from storage:",
                        error
                    );
                }
            }
            return state;

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

    // Load from localStorage on mount
    useEffect(() => {
        dispatch({ type: "LOAD_FROM_STORAGE" });
    }, []);

    // Save to localStorage when state changes
    useEffect(() => {
        localStorage.setItem(
            "sfinx-applied-companies",
            JSON.stringify(state.appliedCompanies)
        );
    }, [state.appliedCompanies]);

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
