export type KeystrokeOp =
    | { kind: "delete"; count: number }
    | { kind: "insert"; text: string };

export type TypingParams = {
    targetWPM?: number; // unused in planning; for future scheduling
    burstSize?: number; // unused in planning; for future scheduling
    backspaceRate?: number; // 0-1
};

export type CodeEdit = {
    file: string;
    range: { start: number; end: number };
    replacement: string;
};

// Expand a single edit into a sequence of delete/insert ops (no timing)
export function expandEditToKeystrokes(
    before: string,
    edit: CodeEdit
): KeystrokeOp[] {
    const { start, end } = edit.range;
    if (start < 0 || end < start || end > before.length) {
        throw new Error("Edit range out of bounds");
    }
    const slice = before.slice(start, end);
    const deletes =
        slice.length > 0
            ? [{ kind: "delete", count: slice.length } as const]
            : [];
    const inserts = edit.replacement.length
        ? [{ kind: "insert", text: edit.replacement } as const]
        : [];
    return [...deletes, ...inserts];
}

export function applyKeystrokesToText(
    before: string,
    startIndex: number,
    ops: KeystrokeOp[]
): string {
    let cursor = startIndex;
    let text = before;
    for (const op of ops) {
        if (op.kind === "delete") {
            text = text.slice(0, cursor) + text.slice(cursor + op.count);
        } else {
            text = text.slice(0, cursor) + op.text + text.slice(cursor);
            cursor += op.text.length;
        }
    }
    return text;
}

// Plan ops for multiple edits and apply fast-forward (no delays)
export function fastForwardApplyEdits(
    before: string,
    edits: CodeEdit[]
): string {
    // Apply in ascending start order; adjust for offset shifts
    const sorted = [...edits].sort((a, b) => a.range.start - b.range.start);
    let delta = 0;
    let text = before;
    for (const e of sorted) {
        const start = e.range.start + delta;
        const end = e.range.end + delta;
        const ops = expandEditToKeystrokes(text, {
            file: e.file,
            range: { start, end },
            replacement: e.replacement,
        });
        text = applyKeystrokesToText(text, start, ops);
        delta += e.replacement.length - (end - start);
    }
    return text;
}
