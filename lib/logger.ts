// Simple centralized logger with optional output controlled via env flags

type LogMethod = (...args: any[]) => void;

function resolveEnabled(): boolean {
    // Prefer explicit flags; supports both server and client builds
    const flag =
        (typeof process !== "undefined" &&
            process.env.NEXT_PUBLIC_DEBUG_LOGS) ||
        (typeof process !== "undefined" && process.env.DEBUG_LOGS) ||
        (typeof process !== "undefined" && process.env.DEBUG);
    if (typeof flag === "string") {
        return flag === "1" || flag.toLowerCase() === "true";
    }
    return Boolean(flag);
}

let enabled = false; //resolveEnabled();

const noop: LogMethod = () => {};

function createMethod(method: keyof Console): LogMethod {
    return (...args: any[]) => {
        if (!enabled) return;
        // eslint-disable-next-line no-console
        (console[method] as LogMethod)(...args);
    };
}

export const logger = {
    get enabled() {
        return enabled;
    },
    setEnabled(value: boolean) {
        enabled = value;
    },
    refresh() {
        enabled = resolveEnabled();
    },
    debug: createMethod("debug"),
    info: createMethod("log"),
    warn: createMethod("warn"),
    error: createMethod("error"),
};

// Optional React hook for ergonomics in components
export function useLogger() {
    return logger;
}
