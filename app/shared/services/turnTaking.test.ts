import { describe, it, expect } from "vitest";
import { TurnTakingCoordinator } from "./turnTaking";

describe("TurnTakingCoordinator", () => {
    it("prevents overlap between speaking and typing", () => {
        const t = new TurnTakingCoordinator();
        expect(t.beginSpeaking()).toBe(true);
        // Attempt to type while speaking should queue and return false
        expect(t.beginTyping()).toBe(false);
        expect(t.isSpeaking).toBe(true);
        t.stop();
        // After stop(), queued typing should start
        expect(t.isTyping).toBe(true);
        t.stop();
        expect(t.mode).toBe("Idle");
    });

    it("prevents overlap between typing and speaking", () => {
        const t = new TurnTakingCoordinator();
        expect(t.beginTyping()).toBe(true);
        expect(t.beginSpeaking()).toBe(false);
        expect(t.isTyping).toBe(true);
        t.stop();
        expect(t.isSpeaking).toBe(true);
    });
});
