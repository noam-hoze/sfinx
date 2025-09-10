#!/usr/bin/env tsx

import { seedCandidateFromFile } from "./seed-candidate-from-json";

export async function seedNoam() {
    await seedCandidateFromFile("server/db-scripts/data/noam.json", {
        reset: true,
    });
}
