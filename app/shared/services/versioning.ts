// Browser-safe deterministic hash (FNV-1a 32-bit)
export function computeHash(text: string): string {
    let hash = 0x811c9dc5; // FNV offset basis
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        // 32-bit FNV prime multiplication
        hash =
            (hash +
                (hash << 1) +
                (hash << 4) +
                (hash << 7) +
                (hash << 8) +
                (hash << 24)) >>>
            0;
    }
    // Return as zero-padded 8-char hex
    return ("00000000" + hash.toString(16)).slice(-8);
}

export function verifyApplyContract(
    incomingVersionId: string,
    incomingBeforeHash: string,
    currentVersionId: string,
    currentText: string
): { ok: true } | { ok: false; reason: string } {
    const currentHash = computeHash(currentText);
    if (incomingVersionId !== currentVersionId) {
        return { ok: false, reason: "versionId mismatch" };
    }
    if (incomingBeforeHash !== currentHash) {
        return { ok: false, reason: "beforeHash mismatch" };
    }
    return { ok: true };
}

export function mintNextVersionId(prevVersionId: string): string {
    // Simple monotonic suffix increment (not cryptographically strong)
    const match = /^(.*?)(\d+)$/.exec(prevVersionId);
    if (!match) return `${prevVersionId}-1`;
    const [, base, num] = match;
    return `${base}${Number(num) + 1}`;
}
