import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const company = (searchParams.get("company") || "meta").toLowerCase();
        const role = (
            searchParams.get("role") || "frontend-engineer"
        ).toLowerCase();
        const filePath = path.join(
            process.cwd(),
            "server",
            "interviews",
            company,
            role,
            "interviewScript.json"
        );
        const raw = await fs.readFile(filePath, "utf8");
        const json = JSON.parse(raw || "{}");
        const backgroundQuestion = json?.backgroundQuestion || "";
        const codingPrompt = json?.codingChallenge?.prompt || "";
        return NextResponse.json({ backgroundQuestion, codingPrompt });
    } catch (error: any) {
        return NextResponse.json(
            {
                error: "Script not found",
                details: String(error?.message || error),
            },
            { status: 404 }
        );
    }
}
