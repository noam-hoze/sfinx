// Shared diff utilities

export function computeCharEditDistance(a: string, b: string): number {
    if (a === b) return 0;
    const n = a.length;
    const m = b.length;
    if (n === 0) return m;
    if (m === 0) return n;
    // Ensure b is longer for slightly better cache behavior
    if (n > m) return computeCharEditDistance(b, a);
    const prev = new Array(m + 1);
    const curr = new Array(m + 1);
    for (let j = 0; j <= m; j++) prev[j] = j;
    for (let i = 1; i <= n; i++) {
        curr[0] = i;
        const ai = a.charCodeAt(i - 1);
        for (let j = 1; j <= m; j++) {
            const cost = ai === b.charCodeAt(j - 1) ? 0 : 1;
            const del = prev[j] + 1;
            const ins = curr[j - 1] + 1;
            const sub = prev[j - 1] + cost;
            curr[j] =
                del < ins ? (del < sub ? del : sub) : ins < sub ? ins : sub;
        }
        for (let j = 0; j <= m; j++) prev[j] = curr[j];
    }
    return prev[m];
}

export function summarizeDelta(
    before: string,
    after: string,
    maxLen = 400
): string {
    if (before === after) return "";
    const a = before || "";
    const b = after || "";
    let i = 0;
    const maxPref = Math.min(a.length, b.length);
    while (i < maxPref && a.charCodeAt(i) === b.charCodeAt(i)) i++;
    let j = 0;
    const maxSuf = Math.min(a.length - i, b.length - i);
    while (
        j < maxSuf &&
        a.charCodeAt(a.length - 1 - j) === b.charCodeAt(b.length - 1 - j)
    )
        j++;
    const changedBefore = a.slice(i, a.length - j);
    const changedAfter = b.slice(i, b.length - j);
    const snippet = (changedAfter || changedBefore || b).slice(0, maxLen);
    return snippet.trim();
}
