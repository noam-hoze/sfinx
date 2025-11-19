"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface MuteContextType {
  isMuted: boolean;
  toggleMute: () => void;
}

const MuteContext = createContext<MuteContextType | undefined>(undefined);

const MUTE_STORAGE_KEY = "sfinx-mute-state";

export function MuteProvider({ children }: { children: React.ReactNode }) {
  // Always start with false for server and initial client render (prevents hydration mismatch)
  const [isMuted, setIsMuted] = useState(false);

  // Sync with localStorage after hydration
  useEffect(() => {
    const stored = localStorage.getItem(MUTE_STORAGE_KEY);
    if (stored === "true") {
      setIsMuted(true);
    }
  }, []);

  // Persist to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(MUTE_STORAGE_KEY, String(isMuted));
  }, [isMuted]);

  const toggleMute = () => {
    setIsMuted((prev) => !prev);
  };

  return (
    <MuteContext.Provider value={{ isMuted, toggleMute }}>
      {children}
    </MuteContext.Provider>
  );
}

export function useMute() {
  const context = useContext(MuteContext);
  if (context === undefined) {
    throw new Error("useMute must be used within a MuteProvider");
  }
  return context;
}

