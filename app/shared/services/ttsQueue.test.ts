import { describe, it, expect, vi } from "vitest";
import { TTSQueue } from "./ttsQueue";

function delay(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
}

describe("TTSQueue", () => {
    it("plays items in order and exposes busy state", async () => {
        const calls: string[] = [];
        const play = vi.fn(async (text: string) => {
            calls.push(text);
            await delay(5);
        });
        const q = new TTSQueue(play);
        await q.speak("a");
        await q.speak("b");
        await q.speak("c");
        // Allow drain to finish
        await delay(30);
        expect(calls).toEqual(["a", "b", "c"]);
        expect(q.busy).toBe(false);
    });

    it("handles errors and continues", async () => {
        const calls: string[] = [];
        const play = vi.fn(async (text: string) => {
            if (text === "bad") throw new Error("boom");
            calls.push(text);
        });
        const errors: string[] = [];
        const q = new TTSQueue(play, {
            onError: (e, t) => errors.push(`${t}:${(e as Error).message}`),
        });
        await q.speak("ok1");
        await q.speak("bad");
        await q.speak("ok2");
        await delay(10);
        expect(calls).toEqual(["ok1", "ok2"]);
        expect(errors[0]).toContain("bad:boom");
    });

    it("clear() stops further items", async () => {
        const calls: string[] = [];
        const play = vi.fn(async (text: string) => {
            calls.push(text);
            await delay(5);
        });
        const q = new TTSQueue(play);
        await q.speak("x");
        await q.speak("y");
        q.clear();
        await q.speak("z");
        await delay(20);
        // 'z' should not play because queue was cancelled and cleared
        expect(calls).toEqual(["x", "y"]);
    });
});
