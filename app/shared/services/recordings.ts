"use client";

import { logger } from ".";
const log = logger.for("@recordings");

export type RecordingStartPayload = {
    session_id: string;
    metadata: any;
};

function getInterviewContext() {
    try {
        const url = new URL(window.location.href);
        const company = url.searchParams.get("company") || undefined;
        const role = url.searchParams.get("role") || undefined;
        const displayName: string | undefined = (window as any)?.__interviewProfile?.displayName;
        const candidateSlug = displayName
            ? displayName
                  .trim()
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/(^-|-$)/g, "")
            : undefined;
        return { company, role, candidateSlug };
    } catch (_) {
        return { company: undefined, role: undefined, candidateSlug: undefined };
    }
}

export async function startRecordingSession(payload: RecordingStartPayload) {
    log.info("startRecordingSession: begin", payload?.session_id, true);
    // Inject interview context
    try {
        if (typeof window !== "undefined") {
            const ctx = getInterviewContext();
            payload.metadata = {
                ...(payload.metadata || {}),
                company: ctx.company,
                role: ctx.role,
                candidate_slug: ctx.candidateSlug,
            };
        }
    } catch (_) {}
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
            (window as any).__company = payload?.metadata?.company;
            (window as any).__role = payload?.metadata?.role;
            (window as any).__candidateSlug = payload?.metadata?.candidate_slug;
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
    let company: string | undefined;
    let role: string | undefined;
    let candidateSlug: string | undefined;
    try {
        if (typeof window !== "undefined") {
            interviewerId = (window as any)?.__interviewerId;
            candidateId = (window as any)?.__candidateId;
            company = (window as any)?.__company;
            role = (window as any)?.__role;
            candidateSlug = (window as any)?.__candidateSlug;
        }
    } catch (_) {}
    const url = new URL("/api/recordings/audio", window.location.origin);
    url.searchParams.set("session_id", sessionId);
    url.searchParams.set("index", String(index));
    if (interviewerId) url.searchParams.set("interviewer_id", interviewerId);
    if (candidateId) url.searchParams.set("candidate_id", candidateId);
    if (company) url.searchParams.set("company", company);
    if (role) url.searchParams.set("role", role);
    if (candidateSlug) url.searchParams.set("candidate", candidateSlug);
    const res = await fetch(url.toString(), {
        method: "POST",
        body: chunk,
    });
    if (!res.ok) throw new Error(await res.text());
}

export async function endRecordingSession(sessionId: string) {
    let interviewerId: string | undefined;
    let candidateId: string | undefined;
    let company: string | undefined;
    let role: string | undefined;
    let candidateSlug: string | undefined;
    try {
        if (typeof window !== "undefined") {
            interviewerId = (window as any)?.__interviewerId;
            candidateId = (window as any)?.__candidateId;
            company = (window as any)?.__company;
            role = (window as any)?.__role;
            candidateSlug = (window as any)?.__candidateSlug;
        }
    } catch (_) {}
    const url = new URL("/api/recordings/end", window.location.origin);
    url.searchParams.set("session_id", sessionId);
    if (interviewerId) url.searchParams.set("interviewer_id", interviewerId);
    if (candidateId) url.searchParams.set("candidate_id", candidateId);
    if (company) url.searchParams.set("company", company);
    if (role) url.searchParams.set("role", role);
    if (candidateSlug) url.searchParams.set("candidate", candidateSlug);
    const res = await fetch(url.toString(), {
        method: "POST",
    });
    if (!res.ok) throw new Error(await res.text());
    try {
        if (typeof window !== "undefined") {
            delete (window as any).__recordingSessionId;
            delete (window as any).__interviewerId;
            delete (window as any).__candidateId;
            delete (window as any).__company;
            delete (window as any).__role;
            delete (window as any).__candidateSlug;
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
    let company: string | undefined;
    let roleParam: string | undefined;
    let candidateSlug: string | undefined;
    try {
        if (typeof window !== "undefined") {
            interviewerId = (window as any)?.__interviewerId;
            candidateId = (window as any)?.__candidateId;
            company = (window as any)?.__company;
            roleParam = (window as any)?.__role;
            candidateSlug = (window as any)?.__candidateSlug;
        }
    } catch (_) {}
    const payload: any = {
        session_id: sessionId,
        interviewer_id: interviewerId,
        candidate_id: candidateId,
        company,
        job_role: roleParam,
        candidate: candidateSlug,
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

export async function appendCodeSnapshot(
    sessionId: string,
    content: string,
    options?: { initial?: boolean; tag?: string }
) {
    let interviewerId: string | undefined;
    let candidateId: string | undefined;
    let company: string | undefined;
    let roleParam: string | undefined;
    let candidateSlug: string | undefined;
    try {
        if (typeof window !== "undefined") {
            interviewerId = (window as any)?.__interviewerId;
            candidateId = (window as any)?.__candidateId;
            company = (window as any)?.__company;
            roleParam = (window as any)?.__role;
            candidateSlug = (window as any)?.__candidateSlug;
        }
    } catch (_) {}
    const payload: any = {
        session_id: sessionId,
        interviewer_id: interviewerId,
        candidate_id: candidateId,
        company,
        job_role: roleParam,
        candidate: candidateSlug,
        ms: Date.now(),
        ts: new Date().toISOString(),
        content,
    };
    if (options?.initial !== undefined)
        payload.initial_code = !!options.initial;
    if (options?.tag) payload.tag = options.tag;
    const res = await fetch("/api/recordings/code/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
}
