export async function playWithOpenAITTS(
    text: string,
    voice?: string
): Promise<void> {
    const res = await fetch("/api/tts/openai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice }),
    });
    if (!res.ok) {
        throw new Error(`OpenAI TTS failed: ${res.status}`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    try {
        const audio = new Audio(url);
        await audio.play();
        await new Promise<void>((resolve) => {
            audio.onended = () => resolve();
        });
    } finally {
        URL.revokeObjectURL(url);
    }
}
