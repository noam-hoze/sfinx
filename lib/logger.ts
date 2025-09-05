/*
 Minimal, consistent, color-coded logger for browser and node.
 Usage:
   const log = createLogger("Conversation");
   log.info("Connected");
*/

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
};

function getEnvLogLevel(): LogLevel {
    const env =
        (typeof process !== "undefined" &&
            (process.env.NEXT_PUBLIC_LOG_LEVEL as LogLevel)) || "info";
    if (["debug", "info", "warn", "error"].includes(env)) return env;
    return "info";
}

const GLOBAL_PREFIX = "SFINX";

function nowHHMMSS(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function isBrowser(): boolean {
    return typeof window !== "undefined" && typeof window.document !== "undefined";
}

function getScopeColor(scope: string): string {
    // Simple stable hash → hue
    let hash = 0;
    for (let i = 0; i < scope.length; i++) {
        hash = (hash * 31 + scope.charCodeAt(i)) | 0;
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue} 70% 40%)`;
}

function shouldLog(level: LogLevel): boolean {
    const threshold = getEnvLogLevel();
    return LEVEL_ORDER[level] >= LEVEL_ORDER[threshold];
}

export function createLogger(scope: string) {
    const scopeColor = getScopeColor(scope);

    function formatParts(level: LogLevel, message: unknown): [any, ...any[]] {
        const time = nowHHMMSS();
        if (isBrowser()) {
            const base = `%c[${GLOBAL_PREFIX}] %c[${level.toUpperCase()}] %c[${scope}] %c${message}`;
            const styles = [
                "color:#64748b;font-weight:600", // prefix
                level === "info"
                    ? "color:#2563eb;font-weight:700"
                    : level === "warn"
                    ? "color:#d97706;font-weight:700"
                    : level === "error"
                    ? "color:#dc2626;font-weight:700"
                    : "color:#6b7280;font-weight:700", // debug
                `color:${scopeColor};font-weight:600`,
                "color:inherit;font-weight:400",
            ];
            return [`${time} ${base}`, ...styles];
        }
        // Node: ANSI colors
        const levelColor =
            level === "info"
                ? "\x1b[34m"
                : level === "warn"
                ? "\x1b[33m"
                : level === "error"
                ? "\x1b[31m"
                : "\x1b[90m"; // debug
        const reset = "\x1b[0m";
        const prefix = "\x1b[90m"; // gray
        const scopeAnsi = "\x1b[36m"; // cyan-ish
        return [
            `${time} ${prefix}[${GLOBAL_PREFIX}]${reset} ${levelColor}[${level.toUpperCase()}]${reset} ${scopeAnsi}[${scope}]${reset} ${String(message)}`,
        ];
    }

    function log(level: LogLevel, message?: unknown, ...optionalParams: unknown[]) {
        if (!shouldLog(level)) return;
        const parts = formatParts(level, message);
        if (level === "error") {
            console.error(...parts, ...optionalParams);
        } else if (level === "warn") {
            console.warn(...parts, ...optionalParams);
        } else if (level === "info") {
            console.info(...parts, ...optionalParams);
        } else {
            console.debug(...parts, ...optionalParams);
        }
    }

    return {
        debug: (message?: unknown, ...optionalParams: unknown[]) =>
            log("debug", message, ...optionalParams),
        info: (message?: unknown, ...optionalParams: unknown[]) =>
            log("info", message, ...optionalParams),
        warn: (message?: unknown, ...optionalParams: unknown[]) =>
            log("warn", message, ...optionalParams),
        error: (message?: unknown, ...optionalParams: unknown[]) =>
            log("error", message, ...optionalParams),
        child: (childScope: string) => createLogger(`${scope}/${childScope}`),
    };
}

export const rootLogger = createLogger("root");

