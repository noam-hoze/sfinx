/**
 * Resolves category scores from AI output using exact key first, then base-name matching.
 */
export function resolveCategoryScore(
    categories: Record<string, any>,
    categoryName: string
): number {
    const exactScore = categories[categoryName]?.score;
    if (typeof exactScore === "number") return exactScore;

    const baseName = categoryName.split(" (")[0];
    const matchingKey = Object.keys(categories).find(
        (key) => key.startsWith(baseName) || categoryName.startsWith(key)
    );
    const matchedScore = matchingKey ? categories[matchingKey]?.score : undefined;
    return typeof matchedScore === "number" ? matchedScore : 0;
}
