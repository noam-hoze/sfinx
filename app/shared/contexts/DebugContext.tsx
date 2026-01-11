"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface DebugContextType {
    isDebugVisible: boolean;
    toggleDebug: () => void;
    showDebugButton: boolean;
    setShowDebugButton: (show: boolean) => void;
}

const DebugContext = createContext<DebugContextType | undefined>(undefined);

export function DebugProvider({ children }: { children: ReactNode }) {
    const isDebugModeEnabled = process.env.NEXT_PUBLIC_DEBUG_MODE === "true";
    const debugPanelVisibleEnv = process.env.NEXT_PUBLIC_DEBUG_PANEL_VISIBLE;
    
    const [isDebugVisible, setIsDebugVisible] = useState(() => {
        if (!isDebugModeEnabled) return false;
        if (debugPanelVisibleEnv === "true") return true;
        if (debugPanelVisibleEnv === "false") return false;
        return true;
    });

    const [showDebugButton, setShowDebugButton] = useState(false);

    const toggleDebug = () => {
        if (!isDebugModeEnabled) return;
        setIsDebugVisible((prev) => !prev);
    };

    // Listen to global toggle event from Header
    useEffect(() => {
        const handleToggle = () => {
            if (isDebugModeEnabled) {
                setIsDebugVisible((prev) => !prev);
            }
        };

        window.addEventListener('toggleDebugPanel', handleToggle);
        return () => window.removeEventListener('toggleDebugPanel', handleToggle);
    }, [isDebugModeEnabled]);

    return (
        <DebugContext.Provider value={{ isDebugVisible, toggleDebug, showDebugButton, setShowDebugButton }}>
            {children}
        </DebugContext.Provider>
    );
}

export function useDebug() {
    const context = useContext(DebugContext);
    if (context === undefined) {
        throw new Error("useDebug must be used within a DebugProvider");
    }
    return context;
}

