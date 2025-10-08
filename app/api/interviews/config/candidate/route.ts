import { NextRequest, NextResponse } from "next/server";
import { buildInterviewConfigs } from "../lib";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const company = searchParams.get("company");
    const roleRaw = searchParams.get("role");
    const candidateId =
        searchParams.get("candidateId") ||
        searchParams.get("candidate") ||
        undefined;
    if (!company || !roleRaw) {
        return NextResponse.json(
            { error: "Missing required query params: company and role" },
            { status: 400 }
        );
    }
    try {
        const built = await buildInterviewConfigs({
            company,
            roleRaw,
            candidateId,
        });
        return NextResponse.json({
            ok: true,
            company: built.company,
            role: built.role,
            candidateId: built.candidateId,
            candidateConfig: built.candidateConfig,
        });
    } catch (e: any) {
        return NextResponse.json(
            {
                error:
                    e?.code === "ENOENT"
                        ? `Interview config not found for ${company}/${roleRaw}`
                        : String(e?.message || e),
            },
            { status: 404 }
        );
    }
}
