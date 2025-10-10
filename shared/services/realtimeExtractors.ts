export function extractUserTranscript(evt: any): string | null {
    return (
        evt?.transcript ??
        evt?.item?.transcript ??
        evt?.item?.content?.[0]?.transcript ??
        evt?.item?.content?.[0]?.text ??
        null
    );
}

export function extractAssistantFinalText(evt: any): string | null {
    const items = evt?.response?.output ?? [];
    const parts: string[] = [];
    for (const it of items) {
        const content = it?.content ?? [];
        for (const c of content) {
            if (typeof c?.text === "string") parts.push(c.text);
            else if (typeof c?.transcript === "string")
                parts.push(c.transcript);
        }
    }
    const full = parts.join("").trim();
    return full || null;
}
