import { useCallback, useRef } from "react";
import { createTurnBuffer } from "../services/openAIRealtimeTurnBuffer";
import type { FinalMessage } from "../types/openAIRealtime";

export function useTurnBuffer() {
    const bufferRef = useRef(createTurnBuffer());
    const add = useCallback((evt: any): FinalMessage[] => {
        return bufferRef.current.ingest(evt);
    }, []);
    const reset = useCallback(() => {
        bufferRef.current.reset();
    }, []);
    return { add, reset };
}
