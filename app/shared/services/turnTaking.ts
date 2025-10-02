export type TurnMode = "Idle" | "Speaking" | "Typing";

export class TurnTakingCoordinator {
    private current: TurnMode = "Idle";
    private queued: TurnMode | null = null;

    get mode(): TurnMode {
        return this.current;
    }

    get isSpeaking(): boolean {
        return this.current === "Speaking";
    }

    get isTyping(): boolean {
        return this.current === "Typing";
    }

    beginSpeaking(): boolean {
        if (this.current === "Speaking") return true; // already speaking
        if (this.current === "Typing") {
            // cannot overlap; queue speaking after typing stops
            this.queued = "Speaking";
            return false;
        }
        this.current = "Speaking";
        return true;
    }

    beginTyping(): boolean {
        if (this.current === "Typing") return true; // already typing
        if (this.current === "Speaking") {
            // cannot overlap; queue typing after speaking stops
            this.queued = "Typing";
            return false;
        }
        this.current = "Typing";
        return true;
    }

    stop(): void {
        // end current mode
        this.current = "Idle";
        // apply queued transition if any
        if (this.queued) {
            const next = this.queued;
            this.queued = null;
            this.current = next;
        }
    }
}
