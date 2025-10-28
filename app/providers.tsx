"use client";

import { SessionProvider } from "next-auth/react";
import { Provider } from "react-redux";
import { store } from "@/shared/state/store";
import { setLevel, setAllowedFiles } from "./shared/services/logger";
import { LOG_LEVEL, ALLOWLIST } from "./shared/services/logger.config";

// Initialize logger once on module load
setLevel(LOG_LEVEL);
setAllowedFiles(ALLOWLIST);

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <Provider store={store}>{children}</Provider>
        </SessionProvider>
    );
}
