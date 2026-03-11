/**
 * Resolve a category key from a map using robust name matching.
 */
export function resolveCategoryKeyByName(
    categories: Record<string, unknown>,
    targetName: string
): string | null {
    if (!targetName) return null;
    if (categories[targetName] !== undefined) return targetName;

    const keys = Object.keys(categories);
    const target = normalizeCategoryName(targetName);
    const targetBase = getBaseCategoryName(target);

    const exactNormalized = keys.find((key) => normalizeCategoryName(key) === target);
    if (exactNormalized) return exactNormalized;

    const sameBase = keys.find(
        (key) => getBaseCategoryName(normalizeCategoryName(key)) === targetBase
    );
    if (sameBase) return sameBase;

    return (
        keys.find((key) => {
            const keyBase = getBaseCategoryName(normalizeCategoryName(key));
            return keyBase.startsWith(targetBase) || targetBase.startsWith(keyBase);
        }) ?? null
    );
}

/**
 * Normalize category labels for stable comparison.
 */
function normalizeCategoryName(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Strip parenthetical suffixes (e.g. "X (details)" -> "x").
 */
function getBaseCategoryName(name: string): string {
    return name.split(" (")[0] ?? name;
}
