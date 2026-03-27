/**
 * Finds the best matching category key for a job category name.
 * Handles common model/name variations like dropped parenthetical suffixes.
 */
export function findCategoryKeyByName(
    categories: Record<string, unknown>,
    categoryName: string
): string | null {
    const keys = Object.keys(categories);
    if (keys.length === 0) return null;

    if (keys.includes(categoryName)) return categoryName;

    const normalizedTarget = normalizeLabel(categoryName);
    const exactNormalized = keys.find((key) => normalizeLabel(key) === normalizedTarget);
    if (exactNormalized) return exactNormalized;

    const baseTarget = getBaseLabel(categoryName);
    const baseMatch = keys.find((key) => getBaseLabel(key) === baseTarget);
    if (baseMatch) return baseMatch;

    return keys.find((key) => {
        const baseKey = getBaseLabel(key);
        return baseKey.startsWith(baseTarget) || baseTarget.startsWith(baseKey);
    }) ?? null;
}

function normalizeLabel(value: string): string {
    return value.trim().toLowerCase();
}

function getBaseLabel(value: string): string {
    return normalizeLabel(value.split(" (")[0] ?? value);
}
