import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const companyParam = searchParams.get("company");
        if (!companyParam) {
            return NextResponse.json(
                { error: "Missing company query parameter" },
                { status: 400 }
            );
        }
        const roleParam = searchParams.get("role");
        if (!roleParam) {
            return NextResponse.json(
                { error: "Missing role query parameter" },
                { status: 400 }
            );
        }
        const company = companyParam.toLowerCase();
        const role = roleParam.toLowerCase();
        const filePath = path.join(
            process.cwd(),
            "server",
            "interviews",
            company,
            role,
            "interviewScript.json"
        );
        const raw = await fs.readFile(filePath, "utf8");
        const json = JSON.parse(raw);
        const backgroundQuestion = json?.backgroundQuestion;
        const codingPrompt = json?.codingChallenge?.prompt;
        const codingTemplate = json?.codingChallenge?.template;
        const codingAnswer = json?.codingChallenge?.answer;
        return NextResponse.json({ backgroundQuestion, codingPrompt, codingTemplate, codingAnswer });
    } catch (error: any) {
        const details = error?.message ? String(error.message) : undefined;
        return NextResponse.json(
            {
                error: "Script not found",
                details,
            },
            { status: 404 }
        );
    }
}
