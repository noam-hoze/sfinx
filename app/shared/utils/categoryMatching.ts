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

    const baseName = categoryName.split(" (")[0];
    return availableKeys.find((key) => key.startsWith(baseName) || categoryName.startsWith(key));
}
