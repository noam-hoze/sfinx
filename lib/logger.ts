// Simple centralized logger with optional output controlled via env flags

type LogMethod = (...args: any[]) => void;
type LogMethodWithOverride = (...args: any[]) => void;

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

let enabled = resolveEnabled();

const noop: LogMethod = () => {};

function createMethod(method: keyof Console): LogMethodWithOverride {
    return (...args: any[]) => {
        // Check if the last argument is a boolean override flag
        const lastArg = args[args.length - 1];
        const hasOverride = typeof lastArg === "boolean";
        const override = hasOverride ? lastArg : false;

        // Log if either globally enabled OR override is true
        if (!enabled && !override) return;

        // Remove override flag from args if present before logging
        const logArgs = hasOverride ? args.slice(0, -1) : args;

        // eslint-disable-next-line no-console
        (console[method] as LogMethod)(...logArgs);
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
