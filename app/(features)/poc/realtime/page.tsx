"use client";

import { useEffect, useRef } from "react";
import { useOpenAIRealtimeVoiceAgent } from "@/shared/hooks/useOpenAIRealtimeVoiceAgent";

export default function RealtimePOCPage() {
    const { status, error, connect, reapplyConfig, onFinalMessage } =
        useOpenAIRealtimeVoiceAgent();
    const connectRef = useRef<() => void>(() => {});

    useEffect(() => {
        connectRef.current = connect;
    }, [connect]);

    useEffect(() => {
        const off = onFinalMessage(
            (m: { role: "user" | "ai"; text: string }) => {
                // Log in the page to mirror previous behavior
                // eslint-disable-next-line no-console
                console.log(m.role === "user" ? "User:" : "AI:", m.text);
            }
        );
        return () => {
            // @ts-ignore
            off?.();
        };
    }, [onFinalMessage]);

    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6">
            <h1 className="text-2xl font-semibold">
                Realtime Voice Agent (POC)
            </h1>
            <p className="text-sm text-gray-500">
                Grants mic permission on connect and starts a Realtime session.
            </p>
            <div className="flex items-center gap-3">
                <button
                    className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
                    onClick={() => connectRef.current()}
                    disabled={status === "connecting" || status === "connected"}
                >
                    {status === "idle" && "Connect"}
                    {status === "connecting" && "Connecting..."}
                    {status === "connected" && "Connected"}
                    {status === "error" && "Retry Connect"}
                </button>
                <button
                    className="rounded-md bg-gray-800 px-4 py-2 text-white disabled:opacity-50"
                    onClick={() => reapplyConfig()}
                    disabled={status !== "connected"}
                >
                    Re-apply Transcription
                </button>
                <span className="text-sm">Status: {status}</span>
            </div>
            {error && (
                <pre className="whitespace-pre-wrap rounded-md bg-red-50 p-3 text-sm text-red-600">
                    {error}
                </pre>
            )}
        </div>
    );
}
