"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { usePathname } from "next/navigation";

interface NavigationState {
  previousPath: string | null;
  currentPath: string;
}

interface NavigationContextType {
  navigationState: NavigationState;
  setNavigationSource: (path: string) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [navigationState, setNavigationState] = useState<NavigationState>({
    previousPath: null,
    currentPath: pathname,
  });

  const setNavigationSource = useCallback((path: string) => {
    setNavigationState(prev => ({
      previousPath: path,
      currentPath: prev.currentPath,
    }));
  }, []);

  return (
    <NavigationContext.Provider value={{ navigationState, setNavigationSource }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error("useNavigation must be used within NavigationProvider");
  }
  return context;
}
