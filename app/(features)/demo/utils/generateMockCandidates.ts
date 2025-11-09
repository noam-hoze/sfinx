/**
 * Utility functions for generating mock candidate data for demo flow.
 */

interface MockCandidate {
    id: string;
    name: string;
    score: number;
    status: "Invited" | "Completed";
    summary: string;
    cpsLink: string;
}

const firstNames = [
    "Alex", "Jordan", "Taylor", "Morgan", "Casey",
    "Riley", "Quinn", "Avery", "Parker", "Reese",
    "Cameron", "Skylar", "Sage", "River", "Phoenix",
    "Dakota", "Rowan", "Elliot", "Jamie", "Blake"
];

const lastNames = [
    "Smith", "Johnson", "Williams", "Brown", "Jones",
    "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
    "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
    "Thomas", "Taylor", "Moore", "Jackson", "Martin"
];

/**
 * Generates a random name from predefined lists.
 */
function generateRandomName(): string {
    const first = firstNames[Math.floor(Math.random() * firstNames.length)];
    const last = lastNames[Math.floor(Math.random() * lastNames.length)];
    return `${first} ${last}`;
}

/**
 * Generates a random score using normal distribution (mean=78, stddev=8).
 */
function generateRandomScore(): number {
    const mean = 78;
    const stddev = 8;
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const score = Math.round(mean + z * stddev);
    return Math.max(60, Math.min(95, score));
}

/**
 * Generates candidate status with 70% completed, 30% invited.
 */
function generateStatus(): "Invited" | "Completed" {
    return Math.random() < 0.7 ? "Completed" : "Invited";
}

/**
 * Generates mock candidates for demo ranked list.
 * @param count Total number of mock candidates to generate
 * @param realCandidateId ID of the actual interview candidate
 */
export function generateMockCandidates(
    count: number,
    realCandidateId: string
): MockCandidate[] {
    const candidates: MockCandidate[] = [];

    for (let i = 0; i < count; i++) {
        const id = `mock-${i}`;
        candidates.push({
            id,
            name: generateRandomName(),
            score: generateRandomScore(),
            status: generateStatus(),
            summary: "Interview analysis pending...",
            cpsLink: `/cps?demo=true&candidateId=${id}`,
        });
    }

    return candidates;
}

