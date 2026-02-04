"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import RiveMascot from "app/(features)/interview/components/RiveMascot";

interface PreloadState {
  isMascotReady: boolean;
}

const InterviewPreloadContext = createContext<PreloadState>({
  isMascotReady: false,
});

export function InterviewPreloadProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [isMascotReady, setIsMascotReady] = useState(false);

  // Pre-load mascot on authentication
  useEffect(() => {
    if (status === "authenticated" && !isMascotReady) {
      console.log("[InterviewPreload] User authenticated, triggering mascot pre-load");
    }
  }, [status, isMascotReady]);

  return (
    <InterviewPreloadContext.Provider value={{ isMascotReady }}>
      {children}
      {/* Hidden mascot renderer to pre-load Rive file */}
      {status === "authenticated" && !isMascotReady && (
        <div className="absolute opacity-0 pointer-events-none" aria-hidden="true">
          <RiveMascot
            onReady={() => {
              console.log("[InterviewPreload] Mascot Rive file loaded");
              setIsMascotReady(true);
            }}
          />
        </div>
      )}
    </InterviewPreloadContext.Provider>
  );
}

export const useInterviewPreload = () => useContext(InterviewPreloadContext);
