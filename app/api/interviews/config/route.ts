import { NextRequest, NextResponse } from "next/server";
import { buildInterviewConfigs } from "./lib";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const company = searchParams.get("company");
    const roleRaw = searchParams.get("role");
    const candidateId =
        searchParams.get("candidateId") ||
        searchParams.get("candidate") ||
        undefined;
    const format = (
        searchParams.get("format") ||
        searchParams.get("view") ||
        "json"
    ).toLowerCase();

    if (!company || !roleRaw) {
        return NextResponse.json(
            { error: "Missing required query params: company and role" },
            { status: 400 }
        );
    }

    // Normalize role slug and apply aliases (DB may use engineer vs developer wording)
    try {
        const built = await buildInterviewConfigs({
            company,
            roleRaw,
            candidateId,
        });
        const payload = {
            ok: true,
            company: built.company,
            role: built.role,
            candidateId: built.candidateId,
            // Back-compat fields
            profile: built.profile,
            interviewerPrompt: built.interviewerPrompt,
            promptTemplates: built.promptTemplates,
            // New structured configs
            candidateConfig: built.candidateConfig,
            interviewerConfig: built.interviewerConfig,
        };

        if (format === "html") {
            const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Interview Config · ${company}/${built.role}${
                built.candidateId ? " · " + built.candidateId : ""
            }</title>
  <style>
    :root { color-scheme: light dark; }
    body { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Inter, Helvetica, Arial, sans-serif; margin: 0; padding: 24px; }
    .wrap { max-width: 920px; margin: 0 auto; }
    h1 { font-size: 20px; margin: 0 0 12px; }
    .meta { color: #6b7280; margin-bottom: 16px; }
    pre { background: rgba(0,0,0,0.04); padding: 16px; border-radius: 10px; overflow: auto; line-height: 1.45; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 12px; }
  </style>
  <script>
    const data = ${JSON.stringify(payload, null, 2)};
    window.__CONFIG__ = data;
  </script>
  </head>
  <body>
    <div class="wrap">
      <h1>Interview Configuration</h1>
      <div class="meta">Company: <strong>${company}</strong> · Role: <strong>${
                built.role
            }</strong>${
                built.candidateId
                    ? ` · Candidate: <strong>${built.candidateId}</strong>`
                    : ""
            }</div>
      <pre><code id="json"></code></pre>
    </div>
    <script>
      document.getElementById('json').textContent = JSON.stringify(window.__CONFIG__, null, 2);
    </script>
  </body>
  </html>`;
            return new NextResponse(html, {
                status: 200,
                headers: { "Content-Type": "text/html; charset=utf-8" },
            });
        }

        return NextResponse.json(payload);
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
