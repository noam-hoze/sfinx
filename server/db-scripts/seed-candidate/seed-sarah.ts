#!/usr/bin/env tsx

import { seedCandidateFromFile } from "./seed-candidate-from-json";

export async function seedSarah() {
    await seedCandidateFromFile("server/db-scripts/data/sarah.json", {
        reset: true,
    });
}

if (require.main === module) {
    seedSarah().catch((e) => {
        console.error("❌ Error seeding Sarah:", e);
        process.exit(1);
    });
}
