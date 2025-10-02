export type PlayFunction = (text: string) => Promise<void>;

export interface TTSQueueOptions {
    onError?: (error: unknown, text: string) => void;
}

export class TTSQueue {
    private readonly play: PlayFunction;
    private readonly onError?: (error: unknown, text: string) => void;
    private queue: string[] = [];
    private isPlaying = false;
    private cancelled = false;

    constructor(play: PlayFunction, options?: TTSQueueOptions) {
        this.play = play;
        this.onError = options?.onError;
    }

    get busy(): boolean {
        return this.isPlaying || this.queue.length > 0;
    }

    clear(): void {
        // Stop processing further items; current in-flight playback will finish
        this.queue = [];
        this.cancelled = true;
    }

    async speak(text: string): Promise<void> {
        // If queue was cancelled via clear(), ignore new items
        if (this.cancelled) return;
        this.queue.push(text);
        if (!this.isPlaying) {
            await this.drain();
        }
    }

    private async drain(): Promise<void> {
        if (this.isPlaying) return;
        this.isPlaying = true;
        try {
            while (!this.cancelled && this.queue.length > 0) {
                const next = this.queue.shift()!;
                try {
                    await this.play(next);
                } catch (err) {
                    // Surface error and continue to next item
                    this.onError?.(err, next);
                }
            }
        } finally {
            this.isPlaying = false;
            // If new items were queued while finishing, and not cancelled, continue
            if (!this.cancelled && this.queue.length > 0) {
                void this.drain();
            }
        }
    }
}
