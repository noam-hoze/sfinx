// Simple centralized logger with optional output controlled via env flags

type LogMethod = (...args: any[]) => void;
type LogMethodWithOverride = (...args: any[]) => void;
type LogLevel = "debug" | "info" | "warn" | "error";

type LoggerMethods = {
    debug: LogMethodWithOverride;
    info: LogMethodWithOverride;
    warn: LogMethodWithOverride;
    error: LogMethodWithOverride;
};

function booleanFromEnv(value: any): boolean | undefined {
    if (value === undefined) return undefined;
    if (typeof value === "string") {
        const v = value.trim().toLowerCase();
        if (v === "1" || v === "true") return true;
        if (v === "0" || v === "false") return false;
    }
    return Boolean(value);
}

function resolveEnabled(): boolean {
    // Prefer explicit flags; supports both server and client builds
    const flag =
        (typeof process !== "undefined" &&
            process.env.NEXT_PUBLIC_DEBUG_LOGS) ||
        (typeof process !== "undefined" && process.env.DEBUG_LOGS) ||
        (typeof process !== "undefined" && process.env.DEBUG);
    const parsed = booleanFromEnv(flag);
    return parsed === undefined ? false : parsed;
}

function resolveAllowedLevels(): Set<LogLevel> {
    const raw =
        (typeof process !== "undefined" &&
            process.env.NEXT_PUBLIC_LOG_LEVELS) ||
        (typeof process !== "undefined" && process.env.LOG_LEVELS);
    if (!raw) return new Set<LogLevel>(["debug", "info", "warn", "error"]);
    const parts = String(raw)
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean) as LogLevel[];
    if (parts.length === 0)
        return new Set<LogLevel>(["debug", "info", "warn", "error"]);
    return new Set(parts);
}

function resolveAllowedModules(): Set<string> | null {
    const raw =
        (typeof process !== "undefined" &&
            process.env.NEXT_PUBLIC_LOG_MODULES) ||
        (typeof process !== "undefined" && process.env.LOG_MODULES);
    if (!raw) return null; // null => no module filtering
    const parts = String(raw)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    if (parts.length === 0 || parts.includes("*")) return null;
    return new Set(parts);
}

function resolveNamespacedOnly(): boolean {
    const raw =
        (typeof process !== "undefined" &&
            process.env.NEXT_PUBLIC_LOG_ONLY_NAMESPACED) ||
        (typeof process !== "undefined" && process.env.LOG_ONLY_NAMESPACED);
    const parsed = booleanFromEnv(raw);
    return parsed === undefined ? false : parsed;
}

let enabled = resolveEnabled();
let allowedLevels = resolveAllowedLevels();
let allowedModules = resolveAllowedModules();
let namespacedOnly = resolveNamespacedOnly();

const noop: LogMethod = () => {};

function mapConsoleMethodToLevel(method: keyof Console): LogLevel | null {
    switch (method) {
        case "debug":
            return "debug";
        case "warn":
            return "warn";
        case "error":
            return "error";
        case "log":
        default:
            return "info";
    }
}

function createMethod(
    method: keyof Console,
    moduleTag?: string
): LogMethodWithOverride {
    return (...args: any[]) => {
        const lastArg = args[args.length - 1];
        const hasOverride = typeof lastArg === "boolean";
        const override = hasOverride ? (lastArg as boolean) : false;

        // If override is true, always log regardless of filters
        if (!override) {
            // Global enable gate
            if (!enabled) return;

            // Namespaced-only gate: skip untagged logs if required
            if (namespacedOnly && !moduleTag) return;

            // Level gate
            const level = mapConsoleMethodToLevel(method);
            if (level && !allowedLevels.has(level)) return;

            // Module gate (if filtering list is provided)
            if (
                allowedModules &&
                (!moduleTag || !allowedModules.has(moduleTag))
            ) {
                return;
            }
        }

        const logArgs = hasOverride ? args.slice(0, -1) : args;
        const prefixedArgs = moduleTag
            ? [`[${moduleTag}]`, ...logArgs]
            : logArgs;

        // eslint-disable-next-line no-console
        (console[method] as LogMethod)(...prefixedArgs);
    };
}

export const logger = {
    get enabled() {
        return enabled;
    },
    setEnabled(value: boolean) {
        enabled = value;
    },
    setLevels(levels: LogLevel[]) {
        allowedLevels = new Set(levels);
    },
    setModules(modules: string[] | null) {
        allowedModules = modules ? new Set(modules) : null;
    },
    setNamespacedOnly(value: boolean) {
        namespacedOnly = value;
    },
    refresh() {
        enabled = resolveEnabled();
        allowedLevels = resolveAllowedLevels();
        allowedModules = resolveAllowedModules();
        namespacedOnly = resolveNamespacedOnly();
    },
    debug: createMethod("debug"),
    info: createMethod("log"),
    warn: createMethod("warn"),
    error: createMethod("error"),
    for(moduleTag: string): LoggerMethods {
        return {
            debug: createMethod("debug", moduleTag),
            info: createMethod("log", moduleTag),
            warn: createMethod("warn", moduleTag),
            error: createMethod("error", moduleTag),
        };
    },
};

// Optional React hook for ergonomics in components
export function useLogger() {
    return logger;
}
