import { NextResponse } from "next/server";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

function buildToolDefs() {
    return [
        {
            type: "function",
            function: {
                name: "open_file",
                description:
                    "Return the current editor buffer with inline line numbers.",
                parameters: {
                    type: "object",
                    properties: {},
                },
            },
        },
        {
            type: "function",
            function: {
                name: "write_file",
                description:
                    "Apply either a full content replace or a list of lineEdits.",
                parameters: {
                    type: "object",
                    properties: {
                        content: { type: "string" },
                        lineEdits: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    op: {
                                        type: "string",
                                        enum: ["replace", "insert", "delete"],
                                    },
                                    line: { type: "number" },
                                    text: { type: "string" },
                                    position: {
                                        type: "string",
                                        enum: ["before", "after"],
                                    },
                                },
                                required: ["op", "line"],
                            },
                        },
                    },
                },
            },
        },
    ];
}

export async function POST(req: Request) {
    try {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: "OPENAI_API_KEY is not set" },
                { status: 500 }
            );
        }

        const body = await req.json();
        const messages = body?.messages ?? [];
        const enableTools = !!body?.enableTools;
        const model = body?.model || "gpt-4o-mini";

        const payload: any = {
            model,
            temperature: 0.3,
            messages,
        };
        if (enableTools) {
            payload.tools = buildToolDefs();
            payload.tool_choice = "auto";
        }

        const res = await fetch(OPENAI_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            const err = await res.text();
            return NextResponse.json(
                { error: `OpenAI error: ${res.status} ${err}` },
                { status: 500 }
            );
        }

        const data = await res.json();
        const choice = data?.choices?.[0]?.message || {};
        const text = choice?.content || "";
        const tool_calls = choice?.tool_calls || [];
        return NextResponse.json({ text, tool_calls });
    } catch (e: any) {
        return NextResponse.json(
            { error: String(e?.message || e) },
            { status: 500 }
        );
    }
}
