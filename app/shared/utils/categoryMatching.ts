/**
 * Resolves a category name against model-returned category keys.
 * Accepts exact matches and legacy/presentational name variants.
 */
export function findCategoryScoreKey(
    categoryName: string,
    availableKeys: string[]
): string | undefined {
    const exact = availableKeys.find((key) => key === categoryName);
    if (exact) return exact;

    const normalizedName = normalizeCategoryName(categoryName);
    return availableKeys.find((key) => normalizeCategoryName(key) === normalizedName);
}

/**
 * Removes presentational suffixes so category names can be matched consistently.
 */
export function normalizeCategoryName(categoryName: string): string {
    return categoryName.replace(/\s*\([^)]*\)\s*$/u, "").trim();
}
