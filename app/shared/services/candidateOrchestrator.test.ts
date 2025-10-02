import { describe, it, expect, vi } from "vitest";
import { TTSQueue } from "./ttsQueue";
import { TurnTakingCoordinator } from "./turnTaking";
import { EditorBufferManager } from "./editorBuffer";
import { computeHash } from "./versioning";
import { handleCandidateResponse } from "./candidateOrchestrator";

function makeTTSRecorder() {
    const spoken: string[] = [];
    const tts = new TTSQueue(async (text) => {
        spoken.push(text);
    });
    return { tts, spoken };
}

describe("handleCandidateResponse", () => {
    it("speaks text then applies code edits with versioning and turn-taking", async () => {
        const { tts, spoken } = makeTTSRecorder();
        const turns = new TurnTakingCoordinator();
        const initial = "hello world";
        const buffer = new EditorBufferManager(initial, "v1", ["f.ts"]);
        const res = await handleCandidateResponse(
            {
                respond: {
                    text: "Acknowledged.",
                    codeEdits: [
                        {
                            file: "f.ts",
                            range: { start: 6, end: 11 },
                            replacement: "sfinx",
                        },
                    ],
                },
                controls: { allowCodeEdits: true },
                apply: { versionId: "v1", beforeHash: computeHash(initial) },
            },
            { tts, turns, buffer, fileAllowlist: ["f.ts"] }
        );
        expect(res.ok).toBe(true);
        expect(spoken).toEqual(["Acknowledged."]);
        expect(buffer.currentText).toBe("hello sfinx");
        // Ensure mode is idle after operations
        expect(turns.mode).toBe("Idle");
    });
});
