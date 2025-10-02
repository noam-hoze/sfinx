import { fastForwardApplyEdits, CodeEdit } from "./typingEmulator";

export function applyCodeEditsSafely(
    currentText: string,
    edits: CodeEdit[],
    options?: { allowlist?: string[] }
): { ok: true; text: string } | { ok: false; reason: string } {
    // Reject out-of-range edits upfront
    for (const e of edits) {
        if (options?.allowlist && !options.allowlist.includes(e.file)) {
            return { ok: false, reason: "file not allowed" };
        }
        if (
            e.range.start < 0 ||
            e.range.end < e.range.start ||
            e.range.end > currentText.length
        ) {
            return { ok: false, reason: "edit range out of bounds" };
        }
    }
    try {
        const next = fastForwardApplyEdits(currentText, edits);
        return { ok: true, text: next };
    } catch (err) {
        return { ok: false, reason: (err as Error).message };
    }
}
