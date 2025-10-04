#!/usr/bin/env ts-node
import fs from "node:fs";

type Pos = { line: number; ch: number };
type Event =
    | { t: number; type: "insert_text"; text: string; pos: Pos }
    | { t: number; type: "delete_backward"; count: number; pos: Pos }
    | { t: number; type: "move_cursor"; pos: Pos }
    | { t: number; type: "paste"; text: string; pos: Pos }
    | { t: number; type: "pause"; ms: number };

function apply(buffer: string[], e: Event): string[] {
    if (e.type === "insert_text" || e.type === "paste") {
        const lines = e.text.split("\n");
        const L = e.pos.line,
            C = e.pos.ch;
        const before = buffer[L] ?? "";
        const left = before.slice(0, C);
        const right = before.slice(C);
        if (lines.length === 1) {
            buffer[L] = left + lines[0] + right;
        } else {
            buffer[L] = left + lines[0];
            for (let i = 1; i < lines.length - 1; i++)
                buffer.splice(L + i, 0, lines[i]);
            buffer.splice(
                L + lines.length - 1,
                0,
                (lines.at(-1) as string) + right
            );
        }
    } else if (e.type === "delete_backward") {
        const L = e.pos.line;
        const C = e.pos.ch;
        const newC = Math.max(0, C - e.count);
        const line = buffer[L] ?? "";
        buffer[L] = line.slice(0, newC) + line.slice(C);
    }
    return buffer;
}

if (require.main === module) {
    const typingPath = process.argv[2];
    if (!typingPath) {
        console.error(
            "Usage: tsx scripts/typing/playback.ts recordings/<session_id>/code/typing.jsonl"
        );
        process.exit(1);
    }
    const init = [""];
    const lines = fs
        .readFileSync(typingPath, "utf8")
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l)) as Event[];
    let buf = init;
    for (const e of lines) {
        if (e.type === "pause") continue;
        buf = apply(buf, e);
    }
    process.stdout.write(buf.join("\n"));
}
