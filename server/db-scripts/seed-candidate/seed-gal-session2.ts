#!/usr/bin/env tsx

import { seedCandidateFromFile } from "./seed-candidate-from-json";
import { log } from "app/shared/services/logger";

export async function seedGalSession2() {
    await seedCandidateFromFile("server/db-scripts/data/gal_session2.json", {
        reset: false,
    });
}

if (require.main === module) {
    seedGalSession2().catch((e) => {
        log.error("❌ Error seeding Gal session 2:", e);
        process.exit(1);
    });
}
