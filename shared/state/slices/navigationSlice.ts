import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "../store";

interface NavigationState {
  breadcrumbSource: string | null;
  history: string[];
}

// Load initial state from sessionStorage if available (client-side only)
const loadInitialState = (): NavigationState => {
  if (typeof window === "undefined") {
    return { breadcrumbSource: null, history: [] };
  }
  
  try {
    const stored = sessionStorage.getItem("navigationState");
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    // Ignore errors
  }
  
  return { breadcrumbSource: null, history: [] };
};

const initialState: NavigationState = loadInitialState();

const navigationSlice = createSlice({
  name: "navigation",
  initialState,
  reducers: {
    setNavigationSource: (state, action: PayloadAction<string>) => {
      state.breadcrumbSource = action.payload;
      if (!state.history.includes(action.payload)) {
        state.history.push(action.payload);
      }
      
      // Persist to sessionStorage
      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem("navigationState", JSON.stringify(state));
        } catch (e) {
          // Ignore errors
        }
      }
    },
    clearNavigationHistory: (state) => {
      state.breadcrumbSource = null;
      state.history = [];
      
      // Clear from sessionStorage
      if (typeof window !== "undefined") {
        try {
          sessionStorage.removeItem("navigationState");
        } catch (e) {
          // Ignore errors
        }
      }
    },
  },
});

export const { setNavigationSource, clearNavigationHistory } = navigationSlice.actions;

export const selectBreadcrumbSource = (state: RootState) => state.navigation.breadcrumbSource;
export const selectNavigationHistory = (state: RootState) => state.navigation.history;

export default navigationSlice.reducer;
