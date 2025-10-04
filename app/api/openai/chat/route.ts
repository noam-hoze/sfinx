import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const enableTools = !!body?.enableTools;
        if (enableTools) {
            return NextResponse.json({
                tool_calls: [
                    {
                        id: "tool_call_1",
                        type: "function",
                        function: { name: "open_file", arguments: {} },
                    },
                ],
                text: "",
            });
        }
        return NextResponse.json({ text: "Applied tool results. Proceeding." });
    } catch (e: any) {
        return NextResponse.json(
            { error: String(e?.message || e) },
            { status: 500 }
        );
    }
}
