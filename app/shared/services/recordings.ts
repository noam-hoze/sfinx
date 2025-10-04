"use client";

export type RecordingStartPayload = {
    session_id: string;
    metadata: any;
};

export async function startRecordingSession(payload: RecordingStartPayload) {
    const res = await fetch("/api/recordings/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()) as { ok: true };
}

export async function sendAudioChunk(
    sessionId: string,
    chunk: Blob,
    index: number
) {
    const res = await fetch(
        `/api/recordings/audio?session_id=${encodeURIComponent(
            sessionId
        )}&index=${index}`,
        {
            method: "POST",
            body: chunk,
        }
    );
    if (!res.ok) throw new Error(await res.text());
}

export async function endRecordingSession(sessionId: string) {
    const res = await fetch(
        `/api/recordings/end?session_id=${encodeURIComponent(sessionId)}`,
        {
            method: "POST",
        }
    );
    if (!res.ok) throw new Error(await res.text());
}
