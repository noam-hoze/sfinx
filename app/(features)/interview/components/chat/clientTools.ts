import { logger } from "../../../../shared/services";
import { appendCodeSnapshot } from "../../../../shared/services/recordings";
import { computeCharEditDistance } from "../../../../shared/utils/diff";
const log = logger.for("@clientTools.ts");

// Simple simulated typing delay factor (ms per character)
const INSERTION_DELAY_PER_CHAR_MS = 200;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function countdownDelay(totalMs: number) {
    const secs = Math.floor(totalMs / 1000);
    for (let s = secs; s >= 1; s--) {
        log.info(`⏳ ${s}sec`);
        await sleep(1000);
    }
    const rem = totalMs - secs * 1000;
    if (rem > 0) await sleep(rem);
}

export type ClientToolCall = {
    type?: string;
    tool_name: "open_file" | "write_file";
    tool_call_id: string;
    parameters?: any;
};

export type ClientToolResult = {
    tool_call_id: string;
    result: any;
    is_error?: boolean;
};

function addLineNumbers(content: string): string {
    return content
        .split("\n")
        .map((line, idx) => `L${idx + 1}:${line}`)
        .join("\n");
}

type LineEdit = {
    op: "replace" | "insert" | "delete";
    line: number; // 1-based
    text?: string; // for replace/insert
    position?: "before" | "after"; // for insert (default: after)
};

function applyLineEdits(original: string, edits: LineEdit[]) {
    const lines = original.split("\n");
    const diffs: Array<{
        line: number;
        before?: string;
        after?: string;
        op: string;
    }> = [];
    const order: Record<LineEdit["op"], number> = {
        delete: 0,
        replace: 1,
        insert: 2,
    } as const;
    const sorted = [...edits].sort((a, b) => {
        const byLine = b.line - a.line;
        if (byLine !== 0) return byLine;
        return order[a.op] - order[b.op];
    });
    log.info("applyLineEdits: sorted edits", sorted);
    sorted.forEach((e) => {
        const idx = Math.max(1, e.line) - 1;
        if (e.op === "replace") {
            const before = lines[idx] ?? "";
            const after = e.text ?? "";
            lines[idx] = after;
            diffs.push({ line: e.line, before, after, op: "replace" });
        } else if (e.op === "insert") {
            const insertIdx = e.position === "before" ? idx : idx + 1;
            const text = e.text ?? "";
            lines.splice(insertIdx, 0, text);
            diffs.push({ line: e.line, after: text, op: "insert" });
        } else if (e.op === "delete") {
            const before = lines[idx] ?? "";
            if (idx >= 0 && idx < lines.length) {
                lines.splice(idx, 1);
                diffs.push({ line: e.line, before, op: "delete" });
            }
        }
    });
    return { content: lines.join("\n"), diffs };
}

export async function executeClientToolCall(
    call: ClientToolCall,
    getCode: () => string,
    setCode: (code: string) => void
): Promise<ClientToolResult> {
    log.info("🛠️ Executing client tool call:", call);
    try {
        if (call.tool_name === "open_file") {
            const contentWithNumbers = addLineNumbers(getCode());
            return {
                tool_call_id: call.tool_call_id,
                result: { content: contentWithNumbers },
            };
        }

        if (call.tool_name === "write_file") {
            const { content, patch, lineEdits } = call.parameters || {};
            if (typeof content === "string") {
                const current = getCode();
                const charDiff = computeCharEditDistance(
                    current || "",
                    content || ""
                );
                const delayMs = INSERTION_DELAY_PER_CHAR_MS * charDiff;
                log.info("🧮 Char edit distance (replace)", {
                    charDiff,
                    delayMs,
                });
                await countdownDelay(delayMs);
                setCode(content);
                try {
                    const sessionId = (window as any)?.__recordingSessionId;
                    if (sessionId) {
                        await appendCodeSnapshot(sessionId, content, {
                            tag: "edit_replace",
                        });
                    }
                } catch (_) {}
                return {
                    tool_call_id: call.tool_call_id,
                    result: {
                        ok: true,
                        mode: "replace",
                        bytes: content.length,
                    },
                };
            }
            // Support simple line-based edits
            if (Array.isArray(lineEdits)) {
                try {
                    const current = getCode();
                    const { content: nextContent, diffs } = applyLineEdits(
                        current,
                        lineEdits as any
                    );
                    // Preserve trailing newline behavior similar to Monaco
                    const normalized = nextContent.endsWith("\n")
                        ? nextContent
                        : nextContent + "\n";
                    const charDiff = computeCharEditDistance(
                        current || "",
                        normalized || ""
                    );
                    const delayMs = INSERTION_DELAY_PER_CHAR_MS * charDiff;
                    log.info("🧮 Char edit distance (lineEdits)", {
                        charDiff,
                        delayMs,
                        diffs,
                    });
                    await countdownDelay(delayMs);
                    setCode(normalized);
                    log.info("✍️ Applied line edits:", diffs);
                    // Snapshot after applying edits
                    try {
                        const sessionId = (window as any)?.__recordingSessionId;
                        if (sessionId) {
                            await appendCodeSnapshot(sessionId, normalized, {
                                tag: "edit_lineEdits",
                            });
                        }
                    } catch (_) {}
                    return {
                        tool_call_id: call.tool_call_id,
                        result: { ok: true, mode: "lineEdits", diffs },
                    };
                } catch (e: any) {
                    return {
                        tool_call_id: call.tool_call_id,
                        result: { ok: false, error: String(e?.message || e) },
                        is_error: true,
                    };
                }
            }
            if (typeof patch === "string") {
                log.warn(
                    "⚠️ Received unsupported unified diff patch; send content or lineEdits"
                );
                return {
                    tool_call_id: call.tool_call_id,
                    result: {
                        ok: false,
                        error: "Unified diff patches are not supported; use content or lineEdits.",
                    },
                    is_error: true,
                };
            }
            return {
                tool_call_id: call.tool_call_id,
                result: { ok: false, error: "No content or patch provided" },
                is_error: true,
            };
        }

        return {
            tool_call_id: call.tool_call_id,
            result: { ok: false, error: `Unknown tool: ${call.tool_name}` },
            is_error: true,
        };
    } catch (error: any) {
        log.error("❌ Tool execution failed:", error);
        return {
            tool_call_id: call.tool_call_id,
            result: { ok: false, error: String(error?.message || error) },
            is_error: true,
        };
    }
}

// No parsing/interception here; tools are registered directly on the session

export function buildClientTools(
    getCode: () => string,
    setCode: (code: string) => void
) {
    return {
        open_file: async () => {
            const result = await executeClientToolCall(
                { tool_name: "open_file", tool_call_id: "client" } as any,
                getCode,
                setCode
            );
            return result.result;
        },
        write_file: async (parameters: any) => {
            if (parameters && typeof parameters.lineEdits === "string") {
                try {
                    parameters.lineEdits = JSON.parse(parameters.lineEdits);
                } catch (_) {}
            }
            const result = await executeClientToolCall(
                {
                    tool_name: "write_file",
                    tool_call_id: "client",
                    parameters,
                } as any,
                getCode,
                setCode
            );
            return result.result;
        },
    };
}

export async function registerClientTools(conversation: any, tools: any) {
    if (!conversation || !tools) return;
    try {
        let registered = false;
        const toolNames = Object.keys(tools || {});
        log.info("registerClientTools: attempting", {
            toolNames,
            hasSet: typeof (conversation as any).setClientTools === "function",
            hasRegister:
                typeof (conversation as any).registerClientTool === "function",
            hasAdd: typeof (conversation as any).addClientTool === "function",
        });

        if (typeof conversation.setClientTools === "function") {
            try {
                conversation.setClientTools(tools);
                log.info("registerClientTools: registered via setClientTools");
                registered = true;
            } catch (e) {
                log.warn("registerClientTools: setClientTools failed", e);
            }
        }
        if (typeof conversation.registerClientTool === "function") {
            try {
                for (const [name, handler] of Object.entries(tools)) {
                    conversation.registerClientTool(name, handler);
                }
                log.info(
                    "registerClientTools: registered via registerClientTool"
                );
                registered = true;
            } catch (e) {
                log.warn(
                    "registerClientTools: registerClientTool loop failed",
                    e
                );
            }
        }
        if (typeof conversation.addClientTool === "function") {
            try {
                for (const [name, handler] of Object.entries(tools)) {
                    conversation.addClientTool(name, handler);
                }
                log.info("registerClientTools: registered via addClientTool");
                registered = true;
            } catch (e) {
                log.warn("registerClientTools: addClientTool loop failed", e);
            }
        }
        log.info("registerClientTools: result", { registered });
        // No-op if SDK lacks APIs; RTC will remain transport-only
        return registered;
    } catch (_) {
        // Swallow; RTC will log connection errors already
        return false;
    }
}
