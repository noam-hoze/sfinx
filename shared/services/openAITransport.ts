export function updateTranscriptionConfig(session: any) {
    try {
        session?.transport?.updateSessionConfig?.({
            audio: {
                input: {
                    transcription: { model: "whisper-1" },
                    turnDetection: { type: "server_vad" },
                },
            },
        });
    } catch {}
}

export function sendSystemNudge(session: any, text: string) {
    try {
        session?.transport?.sendEvent?.({
            type: "conversation.item.create",
            item: {
                type: "message",
                role: "system",
                content: [{ type: "input_text", text }],
            },
        });
        session?.transport?.sendEvent?.({ type: "response.create" });
    } catch {}
}
