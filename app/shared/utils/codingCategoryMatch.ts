/**
 * Finds the best matching category key for a job category name.
 * Returns null when the available matches are ambiguous or missing.
 */
export function findCategoryKeyByName(
    categories: Record<string, unknown>,
    categoryName: string
): string | null {
    const keys = Object.keys(categories);
    if (keys.length === 0) return null;

    const normalizedTarget = normalizeLabel(categoryName);
    const normalizedMatches = keys.filter(
        (key) => normalizeLabel(key) === normalizedTarget
    );
    if (normalizedMatches.length > 1) return null;

    const baseMatches = findBaseMatches(keys, categoryName);
    if (normalizedMatches.length === 1) {
        return baseMatches.length === 1 ? normalizedMatches[0] : null;
    }

    return baseMatches.length === 1 ? baseMatches[0] : null;
}

function normalizeLabel(value: string): string {
    return value.trim().toLowerCase();
}

function getBaseLabel(value: string): string {
    return normalizeLabel(value.split(" (")[0] ?? value);
}

function findSingleMatch(
    keys: string[],
    predicate: (key: string) => boolean
): string | null {
    const matches = keys.filter(predicate);
    return matches.length === 1 ? matches[0] : null;
}

function findBaseMatches(keys: string[], categoryName: string): string[] {
    const baseTarget = getBaseLabel(categoryName);
    return keys.filter((key) => getBaseLabel(key) === baseTarget);
}
