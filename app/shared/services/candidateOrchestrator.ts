import { TTSQueue } from "./ttsQueue";
import { TurnTakingCoordinator } from "./turnTaking";
import { EditorBufferManager } from "./editorBuffer";
import { CodeEdit } from "./typingEmulator";

export type RespondWithCandidate = {
    text?: string;
    codeEdits: CodeEdit[];
};

export type ApplyContract = {
    versionId: string;
    beforeHash: string;
};

export async function handleCandidateResponse(
    params: {
        respond: RespondWithCandidate;
        controls?: { allowCodeEdits?: boolean };
        apply: ApplyContract;
    },
    deps: {
        tts: TTSQueue;
        turns: TurnTakingCoordinator;
        buffer: EditorBufferManager;
        fileAllowlist: string[];
    }
): Promise<{ ok: true } | { ok: false; reason: string }> {
    const { respond, controls, apply } = params;
    const { tts, turns, buffer, fileAllowlist } = deps;

    // Speak (if any)
    if (respond.text) {
        const started = turns.beginSpeaking();
        // Even if queued, calling speak will queue TTS; await completion
        await tts.speak(respond.text);
        if (started) {
            turns.stop();
        }
    }

    // Apply edits (if allowed)
    if (respond.codeEdits.length > 0) {
        if (!controls?.allowCodeEdits) {
            return { ok: false, reason: "code edits not allowed" };
        }
        const started = turns.beginTyping();
        const res = buffer.tryApply({
            versionId: apply.versionId,
            beforeHash: apply.beforeHash,
            edits: respond.codeEdits.map((e) => ({ ...e, file: e.file })),
        });
        if (started) turns.stop();
        if (!res.ok) return { ok: false, reason: res.reason };
    }

    return { ok: true };
}
