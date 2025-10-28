import loglevel from "loglevel";

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

let allowedMatchers: (string | RegExp)[] = [];

function extractCallerLabel(stack: string): string | null {
    const lines = stack.split("\n");
    for (const line of lines) {
        const l = line.trim();
        if (!l) continue;
        if (l.includes("/shared/services/logger")) continue;
        if (l.includes("node_modules/loglevel")) continue;
        // Chrome/Edge format: at func (path:line:col) OR at path:line:col
        let m = l.match(/\(?((?:[a-zA-Z]:)?[^:()]+\.(?:tsx?|jsx?)):(\d+):(\d+)\)?/);
        if (m && m[1]) {
            const filePath = m[1];
            const base = filePath.replace(/\\/g, "/").split("/").pop() || filePath;
            return base;
        }
        // Firefox/Safari: path:line:col
        m = l.match(/((?:[a-zA-Z]:)?[^:()]+\.(?:tsx?|jsx?)):(\d+):(\d+)/);
        if (m && m[1]) {
            const filePath = m[1];
            const base = filePath.replace(/\\/g, "/").split("/").pop() || filePath;
            return base;
        }
    }
    return null;
}

// Wrap methodFactory to optionally gate logs by filename (from stack) and prefix source label
const originalFactory = loglevel.methodFactory;
loglevel.methodFactory = function (methodName, logLevel, loggerName) {
    const raw = originalFactory(methodName, logLevel, loggerName);
    return function (...args: any[]) {
        let stackStr = "";
        try {
            stackStr = new Error().stack || "";
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

export const log = {
    debug: (...args: any[]) => loglevel.debug(...args),
    info: (...args: any[]) => loglevel.info(...args),
    warn: (...args: any[]) => loglevel.warn(...args),
    error: (...args: any[]) => loglevel.error(...args),
};

export function setLevel(level: LogLevel) {
    loglevel.setLevel(level as loglevel.LogLevelDesc);
}

export function setAllowedFiles(matchers: (string | RegExp)[]) {
    allowedMatchers = Array.isArray(matchers) ? matchers : [];
}
