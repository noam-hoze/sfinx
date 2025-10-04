#!/usr/bin/env ts-node
import fs from "node:fs";
import path from "node:path";

const [, , sessionArg, tierArg, taskIdArg, ...rest] = process.argv;
if (!sessionArg || !tierArg || !taskIdArg) {
    console.error(
        "Usage: tsx scripts/new_session.ts <YYYY-MM-DDTHH-mmZ> <tier(2.5|5|7|9)> <task_id> [--with-audio]"
    );
    process.exit(1);
}

const session_id = `${sessionArg}_noam_vs_larry${tierArg}`;
const withAudio = rest.includes("--with-audio");

type Tier = 2.5 | 5 | 7 | 9;
const tier = Number(tierArg) as Tier;

const tierDefaults: Record<
    string,
    {
        seed: number;
        temperature: number;
        behavior_model: string;
        task_brief: string;
        notes: string;
    }
> = {
    "2.5": {
        seed: 1025,
        temperature: 0.65,
        behavior_model: "larry_v4_conf3_mod3_cur3_comm3_calm3_grat3",
        task_brief: "Implement minimal working component; expect guidance.",
        notes: "Low-skill simulation; more guidance from Noam.",
    },
    "5": {
        seed: 1050,
        temperature: 0.5,
        behavior_model: "larry_v4_conf3_mod4_cur3_comm4_calm4_grat4",
        task_brief: "Implement UserList with basic fetch + guards.",
        notes: "Mid skill; some mistakes; steady coaching.",
    },
    "7": {
        seed: 1070,
        temperature: 0.4,
        behavior_model: "larry_v4_conf4_mod4_cur4_comm4_calm4_grat4",
        task_brief:
            "Implement clean UserList with fetch, loading/error states.",
        notes: "Solid mid-level; light hints from Noam.",
    },
    "9": {
        seed: 1090,
        temperature: 0.25,
        behavior_model: "larry_v4_conf5_mod4_cur5_comm5_calm5_grat4",
        task_brief: "Implement robust UserList; anticipate edge cases.",
        notes: "High skill; challenge with refinements.",
    },
};

const defs = tierDefaults[String(tier)];
if (!defs) {
    console.error("Tier must be one of: 2.5, 5, 7, 9");
    process.exit(1);
}

const interviewerId = "noam";
const candidateId = "larry_sim";
const root = path.join(
    "recordings",
    `${interviewerId}_interviewer`,
    `${candidateId}_candidate`,
    session_id
);
const codeDir = path.join(root, "code");
const logsDir = path.join(root, "logs");
fs.mkdirSync(codeDir, { recursive: true });
fs.mkdirSync(logsDir, { recursive: true });

const now = new Date().toISOString();

const metaTpl = fs.readFileSync(
    path.join("templates", "metadata.template.json"),
    "utf8"
);
const metadata = metaTpl
    .replace("{{session_id}}", session_id)
    .replace("{{audio_recorded}}", String(withAudio))
    .replace("{{skill_level}}", String(tier))
    .replace("{{behavior_model}}", defs.behavior_model)
    .replace("{{seed}}", String(defs.seed))
    .replace("{{temperature}}", String(defs.temperature))
    .replace("{{task_id}}", taskIdArg)
    .replace("{{task_brief}}", defs.task_brief)
    .replace("{{started_at}}", `${sessionArg.replace(/_/g, ":")}:00Z`)
    .replace("{{notes}}", defs.notes);

fs.writeFileSync(path.join(root, "metadata.json"), metadata);

const integrityTpl = fs.readFileSync(
    path.join("templates", "integrity.template.json"),
    "utf8"
);
const integrity = integrityTpl
    .replace("{{seed}}", String(defs.seed))
    .replace("{{temperature}}", String(defs.temperature))
    .replace("{{persona_hash}}", "sha256:larry_v4_persona")
    .replace("{{timestamp}}", now);
fs.writeFileSync(path.join(logsDir, "integrity.json"), integrity);

fs.copyFileSync(
    path.join("templates", "transcript.example.jsonl"),
    path.join(root, "transcript.jsonl")
);

const codeStepTpl = fs.readFileSync(
    path.join("templates", "code_step.template.json"),
    "utf8"
);
const step1 = codeStepTpl
    .replace("{{step}}", "1")
    .replace("{{t}}", "0.0")
    .replace("{{file}}", "UserList.tsx")
    .replace("{{tool_call}}", "open_file")
    .replace("{{params}}", "{}")
    .replace("{{mode}}", "")
    .replace("{{content_sha256}}", "")
    .replace("{{description}}", "Initial open.");
fs.writeFileSync(path.join(codeDir, "step_001_open.json"), step1);

const finalSnap = codeStepTpl
    .replace("{{step}}", "999")
    .replace("{{t}}", "180.0")
    .replace("{{file}}", "UserList.tsx")
    .replace("{{tool_call}}", "write_file")
    .replace("{{params}}", '{"content":"/* final component snapshot */"}')
    .replace("{{mode}}", "replace")
    .replace("{{content_sha256}}", "sha256:final")
    .replace("{{description}}", "Final snapshot.");
fs.writeFileSync(path.join(codeDir, "final_snapshot.json"), finalSnap);

console.log(`✅ Created session at ${root}`);
console.log(`   - metadata.json`);
console.log(`   - transcript.jsonl`);
console.log(`   - code/step_001_open.json, final_snapshot.json`);
console.log(`   - logs/integrity.json`);
