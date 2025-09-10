#!/usr/bin/env tsx

import { seedCandidateFromFile } from "./seed-candidate-from-json";

export async function seedMark() {
    await seedCandidateFromFile("server/db-scripts/data/mark.json", {
        reset: true,
    });
}
