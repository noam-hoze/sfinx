"use client";

import { logger } from ".";
const log = logger.for("@recordings");

export type RecordingStartPayload = {
    session_id: string;
    metadata: any;
};

export async function startRecordingSession(payload: RecordingStartPayload) {
    log.info("startRecordingSession: begin", payload?.session_id, true);
    const res = await fetch("/api/recordings/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    try {
        if (typeof window !== "undefined") {
            (window as any).__recordingSessionId = payload?.session_id;
            (window as any).__interviewerId =
                payload?.metadata?.interviewer?.id;
            (window as any).__candidateId = payload?.metadata?.candidate?.id;
        }
    } catch (_) {}
    log.info(
        "startRecordingSession: globals",
        {
            sessionId:
                (typeof window !== "undefined" &&
                    (window as any)?.__recordingSessionId) ||
                null,
            interviewerId:
                (typeof window !== "undefined" &&
                    (window as any)?.__interviewerId) ||
                null,
            candidateId:
                (typeof window !== "undefined" &&
                    (window as any)?.__candidateId) ||
                null,
        },
        true
    );
    return (await res.json()) as { ok: true };
}

export async function sendAudioChunk(
    sessionId: string,
    chunk: Blob,
    index: number
) {
    let interviewerId: string | undefined;
    let candidateId: string | undefined;
    try {
        if (typeof window !== "undefined") {
            interviewerId = (window as any)?.__interviewerId;
            candidateId = (window as any)?.__candidateId;
        }
    } catch (_) {}
    const url = new URL("/api/recordings/audio", window.location.origin);
    url.searchParams.set("session_id", sessionId);
    url.searchParams.set("index", String(index));
    if (interviewerId) url.searchParams.set("interviewer_id", interviewerId);
    if (candidateId) url.searchParams.set("candidate_id", candidateId);
    const res = await fetch(url.toString(), {
        method: "POST",
        body: chunk,
    });
    if (!res.ok) throw new Error(await res.text());
}

export async function endRecordingSession(sessionId: string) {
    let interviewerId: string | undefined;
    let candidateId: string | undefined;
    try {
        if (typeof window !== "undefined") {
            interviewerId = (window as any)?.__interviewerId;
            candidateId = (window as any)?.__candidateId;
        }
    } catch (_) {}
    const url = new URL("/api/recordings/end", window.location.origin);
    url.searchParams.set("session_id", sessionId);
    if (interviewerId) url.searchParams.set("interviewer_id", interviewerId);
    if (candidateId) url.searchParams.set("candidate_id", candidateId);
    const res = await fetch(url.toString(), {
        method: "POST",
    });
    if (!res.ok) throw new Error(await res.text());
    try {
        if (typeof window !== "undefined") {
            delete (window as any).__recordingSessionId;
            delete (window as any).__interviewerId;
            delete (window as any).__candidateId;
        }
    } catch (_) {}
    log.info("endRecordingSession: cleared", sessionId, true);
}

export async function appendTranscriptLine(
    sessionId: string,
    role: "interviewer" | "candidate" | "tool",
    speaker: string,
    text: string
) {
    log.info(
        "appendTranscriptLine: begin",
        { sessionId, role, speaker, text },
        true
    );
    let interviewerId: string | undefined;
    let candidateId: string | undefined;
    try {
        if (typeof window !== "undefined") {
            interviewerId = (window as any)?.__interviewerId;
            candidateId = (window as any)?.__candidateId;
        }
    } catch (_) {}
    const payload: any = {
        session_id: sessionId,
        interviewer_id: interviewerId,
        candidate_id: candidateId,
        t: Date.now(),
        role,
        speaker,
        text,
    };
    log.info("appendTranscriptLine: POST", payload, true);
    const res = await fetch("/api/recordings/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    log.info("appendTranscriptLine: ok", true);
}
