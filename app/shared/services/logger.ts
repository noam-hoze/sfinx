/**
 * Logger service with file and category filtering.
 */
import loglevel from "loglevel";
import { CATEGORY_FILTER, CATEGORY_FILTER_MODE, LABEL_OVERRIDES, type LogCategory } from "./logger.config";

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";
export type { LogCategory };

let allowedMatchers: (string | RegExp)[] = [];

function assertCategory(category: LogCategory): string {
    if (!category || typeof category !== "string") {
        throw new Error("Log category is required.");
    }
    return category;
}

function isCategoryAllowed(category: LogCategory): boolean {
    if (CATEGORY_FILTER_MODE === "allowlist") {
        return CATEGORY_FILTER.includes(category);
    }
    return !CATEGORY_FILTER.includes(category);
}

function applyLabelOverrides(filePath: string, computed: string): string {
    for (const o of LABEL_OVERRIDES) {
        if (typeof o.match === "string") {
            if (filePath.includes(o.match)) return o.label;
        } else if (o.match.test(filePath)) {
            return o.label;
        }
    }
    return computed;
}

function computePageOrFile(filePath: string, base: string): string {
    const normalized = filePath.replace(/\\/g, "/");
    const parts = normalized.split("/");
    const baseName = base.replace(/\.(t|j)sx?$/, "");
    // If this is a Next route file, prefer the parent directory name as page label
    if (/^(page|layout|route)$/.test(baseName)) {
        const appIdx = parts.lastIndexOf("app");
        const startIdx = appIdx >= 0 ? appIdx + 1 : Math.max(0, parts.length - 3);
        const dirParts = parts.slice(startIdx, parts.length - 1); // exclude filename
        const cleaned = dirParts.filter((p) => !/^\(.+\)$/.test(p));
        const last = cleaned[cleaned.length - 1];
        if (!last) {
            throw new Error(`Unable to compute page label for ${filePath}`);
        }
        return last.replace(/\[(.+?)\]/g, ":$1");
    }
    // Otherwise use the file basename without extension
    return baseName;
}

function extractCallerLabel(stack: string): string | null {
    const lines = stack.split("\n");
    for (const line of lines) {
        const l = line.trim();
        if (!l) continue;
        if (l.includes("/shared/services/logger")) continue;
        if (l.includes("node_modules/loglevel")) continue;
        // Try to capture function name if present: at func (path:line:col)
        const fnMatch = l.match(/at\s+([\w$.<>]+)\s*\(/);
        let labelFromFn: string | null = null;
        if (fnMatch && fnMatch[1]) {
            const fnParts = fnMatch[1].split(".");
            const fn = fnParts[fnParts.length - 1];
            if (!fn) {
                throw new Error("Unable to extract function name from stack frame");
            }
            if (fn !== "Object" && fn !== "Module") labelFromFn = fn;
        }
        let m = l.match(/\(?((?:[a-zA-Z]:)?[^:()]+\.(?:tsx?|jsx?)):(\d+):(\d+)\)?/);
        if (m && m[1]) {
            const filePath = m[1];
            const segments = filePath.replace(/\\/g, "/").split("/");
            const base = segments[segments.length - 1];
            if (!base) {
                throw new Error(`Unable to determine base filename for ${filePath}`);
            }
            const pageOrFile = computePageOrFile(filePath, base);
            const overridden = applyLabelOverrides(filePath, pageOrFile);
            return labelFromFn ? `${overridden}/${labelFromFn}` : overridden;
        }
        m = l.match(/((?:[a-zA-Z]:)?[^:()]+\.(?:tsx?|jsx?)):(\d+):(\d+)/);
        if (m && m[1]) {
            const filePath = m[1];
            const segments = filePath.replace(/\\/g, "/").split("/");
            const base = segments[segments.length - 1];
            if (!base) {
                throw new Error(`Unable to determine base filename for ${filePath}`);
            }
            const pageOrFile = computePageOrFile(filePath, base);
            const overridden = applyLabelOverrides(filePath, pageOrFile);
            return overridden;
        }
    }
    return null;
}

// Wrap methodFactory to optionally gate logs by filename (from stack) and prefix source label
const originalFactory = loglevel.methodFactory;
loglevel.methodFactory = function (methodName, logLevel, loggerName) {
    const raw = originalFactory(methodName, logLevel, loggerName);
    return function (...args: any[]) {
        let stackStr: string | undefined;
        try {
            stackStr = new Error().stack;
        } catch {}

        if (allowedMatchers.length > 0 && stackStr) {
            try {
                const isAllowed = allowedMatchers.some((m) =>
                    typeof m === "string" ? stackStr.includes(m) : m.test(stackStr)
                );
                if (!isAllowed) return;
            } catch {}
        }

        const label = stackStr ? extractCallerLabel(stackStr) : null;
        const prefixedArgs = label ? [`[${label}]`, ...args] : args;
        raw(...prefixedArgs);
    };
};

// Re-apply current level after methodFactory override
loglevel.setLevel(loglevel.getLevel());

function emitLog(level: LogLevel, category: LogCategory, args: any[]): void {
    const verifiedCategory = assertCategory(category);
    if (!isCategoryAllowed(verifiedCategory)) return;
    const prefixedArgs = [`[${verifiedCategory}]`, ...args];
    loglevel[level](...prefixedArgs);
}

/** Logger that requires a category for each call. */
export const log = {
    debug: (category: LogCategory, ...args: any[]) => emitLog("debug", category, args),
    info: (category: LogCategory, ...args: any[]) => emitLog("info", category, args),
    warn: (category: LogCategory, ...args: any[]) => emitLog("warn", category, args),
    error: (category: LogCategory, ...args: any[]) => emitLog("error", category, args),
};

/** Set the global log level. */
export function setLevel(level: LogLevel) {
    loglevel.setLevel(level as loglevel.LogLevelDesc);
}

/** Set file matchers that are allowed to emit logs. */
export function setAllowedFiles(matchers: (string | RegExp)[]) {
    allowedMatchers = Array.isArray(matchers) ? matchers : [];
}
