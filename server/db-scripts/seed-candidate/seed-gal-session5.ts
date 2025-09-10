#!/usr/bin/env tsx

import { seedCandidateFromFile } from "./seed-candidate-from-json";

export async function seedGalSession5() {
    await seedCandidateFromFile("server/db-scripts/data/gal_session5.json", {
        reset: false,
    });
}

if (require.main === module) {
    seedGalSession5().catch((e) => {
        console.error("❌ Error seeding Gal session 5:", e);
        process.exit(1);
    });
}
