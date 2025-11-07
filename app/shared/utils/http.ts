/**
 * Reads a human-readable error message from a failed fetch response.
 */
export async function readResponseError(response: Response): Promise<string> {
    try {
        const text = await response.text();
        if (text.trim().length > 0) {
            return text;
        }
    } catch {
        // Ignore body read failures.
    }
    const statusText = response.statusText;
    if (statusText.trim().length > 0) {
        return statusText;
    }
    return "Unknown error";
}

