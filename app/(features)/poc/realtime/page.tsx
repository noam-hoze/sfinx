"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export default function RealtimePOCPage() {
    const [status, setStatus] = useState<
        "idle" | "connecting" | "connected" | "error"
    >("idle");
    const [error, setError] = useState<string | null>(null);
    const connectRef = useRef<() => void>(() => {});

    const connect = useCallback(async () => {
        setStatus("connecting");
        setError(null);
        try {
            const res = await fetch("/api/openai/realtime", { method: "POST" });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || "Failed to fetch ephemeral key");
            }
            const { value: apiKey } = await res.json();
            if (!apiKey) throw new Error("Missing ephemeral key in response");

            // Dynamically import to avoid SSR issues if we later add SDK usage
            const { RealtimeAgent, RealtimeSession } = await import(
                "@openai/agents/realtime"
            );
            const agent = new RealtimeAgent({
                name: "Assistant",
                instructions: "You are a helpful assistant.",
            });
            const session = new RealtimeSession(agent, {
                model: "gpt-4o-realtime-preview-2024-12-17",
                voice: "verse",
                modalities: ["text", "audio"],
            });
            await session.connect({ apiKey });
            setStatus("connected");
        } catch (e: any) {
            setStatus("error");
            setError(String(e?.message || e));
        }
    }, []);

    useEffect(() => {
        connectRef.current = connect;
    }, [connect]);

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
