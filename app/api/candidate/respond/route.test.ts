import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "node:path";

vi.mock("next-auth/next", () => ({
    getServerSession: vi.fn().mockResolvedValue({ user: { role: "COMPANY" } }),
}));

async function importRoute() {
    const routePath = path.resolve(
        "/Users/noonejoze/Projects/sfinx/app/api/candidate/respond/route.ts"
    );
    return import(routePath);
}

function makeRequest(body: unknown) {
    return { json: async () => body } as any;
}

const baseRequest = {
    context: {
        file: "app/foo.ts",
        versionId: "v1",
        beforeHash: "abc",
    },
    history: [],
    controls: { allowCodeEdits: true, maxEditSize: 1000 },
    respondWithCandidate: {
        text: "Sure, I'll update the handler.",
        codeEdits: [
            {
                file: "app/foo.ts",
                range: { start: 0, end: 0 },
                replacement: "export const x = 1;\n",
            },
        ],
    },
};

describe("POST /api/candidate/respond", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("accepts valid payload when edits allowed", async () => {
        const { POST } = await importRoute();
        const res = await POST(makeRequest(baseRequest));
        expect(res.status).toBe(200);
        const json = await (res as any).json();
        expect(json.ok).toBe(true);
        expect(json.respondWithCandidate.codeEdits).toHaveLength(1);
    });

    it("rejects code in text", async () => {
        const { POST } = await importRoute();
        const res = await POST(
            makeRequest({
                ...baseRequest,
                respondWithCandidate: {
                    ...baseRequest.respondWithCandidate,
                    text: "```const a = 1```",
                },
            })
        );
        expect(res.status).toBe(400);
    });

    it("rejects edits when not allowed", async () => {
        const { POST } = await importRoute();
        const res = await POST(
            makeRequest({
                ...baseRequest,
                controls: { allowCodeEdits: false },
            })
        );
        expect(res.status).toBe(400);
    });
});
