#!/usr/bin/env ts-node
import fs from "node:fs";
import seedrandom from "seedrandom";

type Pos = { line: number; ch: number };
type Event =
    | { t: number; type: "insert_text"; text: string; pos: Pos }
    | { t: number; type: "delete_backward"; count: number; pos: Pos }
    | { t: number; type: "move_cursor"; pos: Pos }
    | { t: number; type: "paste"; text: string; pos: Pos }
    | { t: number; type: "pause"; ms: number };

type Knobs = {
    wpm: [number, number];
    errorRate: number;
    burstLen: [number, number];
    pauseMs: [number, number];
    pasteRatio: number;
};
const tiers: Record<string, Knobs> = {
    "2.5": {
        wpm: [22, 32],
        errorRate: 0.075,
        burstLen: [2, 5],
        pauseMs: [150, 400],
        pasteRatio: 0.0,
    },
    "5": {
        wpm: [35, 45],
        errorRate: 0.035,
        burstLen: [3, 7],
        pauseMs: [120, 300],
        pasteRatio: 0.05,
    },
    "7": {
        wpm: [48, 60],
        errorRate: 0.015,
        burstLen: [5, 12],
        pauseMs: [90, 220],
        pasteRatio: 0.1,
    },
    "9": {
        wpm: [65, 80],
        errorRate: 0.008,
        burstLen: [8, 18],
        pauseMs: [60, 160],
        pasteRatio: 0.2,
    },
};

const neighbors: Record<string, string[]> = {
    o: ["i", "p", "9", "0"],
    p: ["o", "0"],
    n: ["b", "h", "m"],
    m: ["n", "j"],
    0: ["9", "p"],
    e: ["w", "r"],
    a: ["s", "q"],
    s: ["a", "d"],
    t: ["r", "y"],
};

function sample(r: () => number, [a, b]: [number, number]) {
    return a + r() * (b - a);
}
function pick<T>(r: () => number, arr: T[]) {
    return arr[Math.floor(r() * arr.length)];
}
function maybeTypo(r: () => number, ch: string) {
    if (neighbors[ch] && r() < 0.5) return pick(r, neighbors[ch]);
    return ch;
}

export function generateTyping(
    seed: number,
    tier: "2.5" | "5" | "7" | "9",
    text: string
) {
    const rng = seedrandom(String(seed));
    const k = tiers[tier];
    const events: Event[] = [];
    let t = 0;
    let line = 0;
    let ch = 0;

    const chars = [...text];
    let i = 0;
    while (i < chars.length) {
        const burst = Math.floor(sample(rng, k.burstLen));
        const wpm = sample(rng, k.wpm);
        const cps = (wpm * 5) / 60; // chars/sec
        const dt = 1 / Math.max(1, cps);

        // occasional pause before burst
        if (rng() < 0.3) t += sample(rng, k.pauseMs) / 1000;

        for (let b = 0; b < burst && i < chars.length; b++, i++) {
            const c = chars[i];

            // paste for boilerplate tokens
            if (
                rng() < k.pasteRatio &&
                /[A-Za-z_]{8,}/.test(
                    text.slice(i, Math.min(i + 20, text.length))
                )
            ) {
                const slice = text.slice(i, Math.min(i + 20, text.length));
                events.push({
                    t,
                    type: "paste",
                    text: slice,
                    pos: { line, ch },
                });
                const lines = slice.split("\n");
                if (lines.length === 1) ch += slice.length;
                else {
                    line += lines.length - 1;
                    ch = lines.at(-1)!.length;
                }
                i += slice.length - 1;
                t += 0.02;
                continue;
            }

            // typo injection
            let out = c;
            if (rng() < k.errorRate && /\w/.test(c)) out = maybeTypo(rng, c);

            events.push({
                t,
                type: "insert_text",
                text: out,
                pos: { line, ch },
            });
            if (out === "\n") {
                line++;
                ch = 0;
            } else {
                ch++;
            }
            t += dt;

            if (out !== c) {
                events.push({
                    t,
                    type: "pause",
                    ms: Math.floor(sample(rng, [40, 120])),
                });
                events.push({
                    t: t + 0.001,
                    type: "delete_backward",
                    count: 1,
                    pos: { line, ch },
                });
                t += 0.04;
                const fix = c;
                events.push({
                    t,
                    type: "insert_text",
                    text: fix,
                    pos: { line, ch: ch - 1 },
                });
                t += dt * 0.8;
            }
        }

        if (i < chars.length && /[\n;},)]/.test(chars[i])) {
            events.push({
                t,
                type: "pause",
                ms: Math.floor(sample(rng, [80, 220])),
            });
        }
    }
    return events;
}

if (require.main === module) {
    const [, , tier = "7", seed = "1070"] = process.argv;
    const text = fs.readFileSync(0, "utf8");
    const events = generateTyping(Number(seed), tier as any, text);
    for (const e of events) process.stdout.write(JSON.stringify(e) + "\n");
}
