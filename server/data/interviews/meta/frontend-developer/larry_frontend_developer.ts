import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readText(relativePath: string): string {
    try {
        const p = path.resolve(__dirname, relativePath);
        return fs.readFileSync(p, "utf8").trim();
    } catch (e) {
        return "";
    }
}

const prompt = readText("./candidatePrompt.txt");
const jobDescription = readText("./jobDescription.txt");

const larryFrontendDeveloper = {
    id: "larry_frontend_developer",
    role: "candidate",
    name: "larry_frontend_developer",
    displayName: "Larry",
    placeholders: ["{{task_brief}}", "{{editor_content}}", "{{last_error}}"],
    tools: {
        open_file: { returns: "{ content }" },
        write_file: {
            params: ["content", "lineEdits"],
            lineEditsSpec: {
                op: "replace|insert|delete",
                line: "number",
                text: "string?",
                position: "before|after?",
            },
        },
    },
    characteristics: {
        independence: 4,
        creativity: 4,
        testingCode: 4,
        documenting: 3,
        speed: 4,
        thoroughness: 4,
        collaboration: 4,
        problemSolving: 4,
    },
    prompt,
    jobDescription,
};

export default larryFrontendDeveloper;
