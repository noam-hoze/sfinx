#!/usr/bin/env node
/**
 * @file Orchestrates local verification by enforcing the test-first workflow.
 */
import { spawnSync } from "node:child_process";

const fastLaneEnabled = ["1", "true", "yes"].includes(
    (process.env.FAST_LANE ?? "").toLowerCase(),
);

if (fastLaneEnabled) {
    const reason = process.env.FAST_LANE_REASON ?? "";
    const followUp = process.env.FAST_LANE_FOLLOW_UP ?? "";
    const dueDate = process.env.FAST_LANE_DUE_DATE ?? "";

    if (!reason.trim() || !followUp.trim() || !dueDate.trim()) {
        console.error(
            "FAST_LANE override requires FAST_LANE_REASON, FAST_LANE_FOLLOW_UP, and FAST_LANE_DUE_DATE.",
        );
        process.exit(1);
    }

    console.log("FAST_LANE override engaged. Skipping automated test execution.");
    console.log(`Skip reason: ${reason}`);
    console.log(`Follow-up ticket: ${followUp}`);
    console.log(`Due date: ${dueDate}`);
    console.log("Reviewers must confirm follow-up ownership before merge.");
    process.exit(0);
}

const run = (command, args) => {
    const result = spawnSync(command, args, { stdio: "inherit" });
    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
};

run("pnpm", ["run", "test:unit"]);
run("pnpm", ["run", "test:e2e"]);
