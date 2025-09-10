#!/usr/bin/env tsx

import { seedCandidateFromFile } from "./seed-candidate-from-json";

export async function seedGalSession2() {
    await seedCandidateFromFile("server/db-scripts/data/gal_session2.json", {
        reset: false,
    });
}

if (require.main === module) {
    seedGalSession2().catch((e) => {
        console.error("❌ Error seeding Gal session 2:", e);
        process.exit(1);
    });
}
