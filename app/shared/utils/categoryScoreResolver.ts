type CategoryScoreEntry = { score?: number };

function normalizeExactCategoryName(categoryName: string): string {
    return categoryName.trim().toLowerCase();
}

function normalizeBaseCategoryName(categoryName: string): string {
    return normalizeExactCategoryName(
        categoryName.replace(/\s+\([^)]*\)$/u, "")
    );
}

/**
 * Resolves a stored category key using exact match or a unique normalized match.
 */
export function resolveCategoryKey(
    categories: Record<string, unknown>,
    categoryName: string
): string | undefined {
    if (Object.prototype.hasOwnProperty.call(categories, categoryName)) {
        return categoryName;
    }
    const exactName = normalizeExactCategoryName(categoryName);
    const exactMatches = Object.keys(categories).filter(
        (key) => normalizeExactCategoryName(key) === exactName
    );
    if (exactMatches.length === 1) return exactMatches[0];
    if (exactMatches.length > 1) return undefined;

    const baseName = normalizeBaseCategoryName(categoryName);
    const baseMatches = Object.keys(categories).filter(
        (key) => normalizeBaseCategoryName(key) === baseName
    );
    if (baseMatches.length === 1) return baseMatches[0];
    return undefined;
}

/**
 * Resolves a stored category value using the shared category-key matcher.
 */
export function resolveCategoryValue<T>(
    categories: Record<string, T>,
    categoryName: string
): T | undefined {
    const resolvedKey = resolveCategoryKey(categories, categoryName);
    return resolvedKey ? categories[resolvedKey] : undefined;
}

/**
 * Resolves a category score from AI output without cross-matching sibling categories.
 */
export function resolveCategoryScore(
    categories: Record<string, CategoryScoreEntry>,
    categoryName: string
): number {
    const resolvedScore = resolveCategoryValue(categories, categoryName)?.score;
    return typeof resolvedScore === "number" ? resolvedScore : 0;
}
