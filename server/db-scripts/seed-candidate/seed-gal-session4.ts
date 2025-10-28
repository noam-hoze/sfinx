#!/usr/bin/env tsx

import { seedCandidateFromFile } from "./seed-candidate-from-json";
import { log } from "app/shared/services";

export async function seedGalSession4() {
    await seedCandidateFromFile("server/db-scripts/data/gal_session4.json", {
        reset: false,
    });
}

if (require.main === module) {
    seedGalSession4().catch((e) => {
        log.error("❌ Error seeding Gal session 4:", e);
        process.exit(1);
    });
}
