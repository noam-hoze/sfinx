#!/usr/bin/env tsx

import { seedCandidateFromFile } from "./seed-candidate-from-json";

export async function seedGal() {
    await seedCandidateFromFile("server/db-scripts/data/gal.json", {
        reset: true,
    });
}
