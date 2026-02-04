"use client";

import React, { createContext, useContext, ReactNode } from "react";

interface JobPageContextType {
    activeSection: string;
    setActiveSection: (id: string) => void;
    expandedSections: string[];
    setExpandedSections: (sections: string[]) => void;
    interviewTab?: 'experience' | 'coding';
    setInterviewTab?: (tab: 'experience' | 'coding') => void;
}

const JobPageContext = createContext<JobPageContextType | null>(null);

export function JobPageProvider({ children, value }: { children: ReactNode; value: JobPageContextType }) {
    return (
        <JobPageContext.Provider value={value}>
            {children}
        </JobPageContext.Provider>
    );
}

export function useJobPageContext() {
    const context = useContext(JobPageContext);
    if (!context) {
        throw new Error("useJobPageContext must be used within JobPageProvider");
    }
    return context;
}
