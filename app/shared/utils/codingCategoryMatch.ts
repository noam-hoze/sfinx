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

    if (keys.includes(categoryName)) return categoryName;

    const normalizedTarget = normalizeLabel(categoryName);
    const normalizedMatch = findSingleMatch(
        keys,
        (key) => normalizeLabel(key) === normalizedTarget
    );
    if (normalizedMatch) return normalizedMatch;

    return findSingleBaseMatch(keys, categoryName);
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

function findSingleBaseMatch(keys: string[], categoryName: string): string | null {
    const baseTarget = getBaseLabel(categoryName);
    return findSingleMatch(keys, (key) => getBaseLabel(key) === baseTarget);
}
