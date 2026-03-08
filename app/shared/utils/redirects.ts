const DEFAULT_REDIRECT = "/";

export function sanitizeNextPath(
    value: string | null | undefined,
    fallback = DEFAULT_REDIRECT
): string {
    if (!value) {
        return fallback;
    }

    if (!value.startsWith("/")) {
        return fallback;
    }

    if (value.startsWith("//")) {
        return fallback;
    }

    return value;
}

export function appendNextParam(path: string, nextPath: string): string {
    const params = new URLSearchParams({ next: nextPath });
    return `${path}?${params.toString()}`;
}

export function isInterviewRedirect(value: string | null | undefined): boolean {
    return typeof value === "string" && value.startsWith("/interview?");
}
