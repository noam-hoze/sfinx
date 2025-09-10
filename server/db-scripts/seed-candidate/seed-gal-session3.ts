#!/usr/bin/env tsx

import { seedCandidateFromFile } from "./seed-candidate-from-json";

export async function seedGalSession3() {
    await seedCandidateFromFile("server/db-scripts/data/gal_session3.json", {
        reset: false,
    });
}

if (require.main === module) {
    seedGalSession3().catch((e) => {
        console.error("❌ Error seeding Gal session 3:", e);
        process.exit(1);
    });
}
