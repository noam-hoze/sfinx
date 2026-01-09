/**
 * Category-based gate check for background interviews
 * Determines when to transition from background to coding based on CategoryContribution coverage
 */

export interface CategoryCoverageStats {
  categoryName: string;
  count: number;
  avgStrength: number;
}

export interface GateCheckResult {
  gateReady: boolean;
  reason?: string;
}

/**
 * Check if background interview gate is satisfied based on category contribution coverage
 * 
 * Gate is satisfied when:
 * - All categories have at least 1 contribution with strength >= 30, OR
 * - At least 75% of categories have contributions, OR
 * - Any category has 5+ contributions (depth over breadth)
 */
export function checkCategoryGate(
  categoryStats: CategoryCoverageStats[],
  experienceCategories: Array<{ name: string; description: string; weight: number }>
): GateCheckResult {
  if (!experienceCategories || experienceCategories.length === 0) {
    return { gateReady: false, reason: "No experience categories defined" };
  }

  if (!categoryStats || categoryStats.length === 0) {
    return { gateReady: false, reason: "No contributions yet" };
  }

  const totalCategories = experienceCategories.length;
  const MIN_STRENGTH = 30; // Minimum strength to count as meaningful contribution
  const MIN_COVERAGE_PERCENT = 0.75; // 75% of categories need coverage

  // Count categories with meaningful contributions
  const categoriesWithContributions = categoryStats.filter(
    stat => stat.count > 0 && stat.avgStrength >= MIN_STRENGTH
  ).length;

  // Check if any category has deep coverage (5+ contributions)
  const hasDeepCoverage = categoryStats.some(stat => stat.count >= 5);

  // Check if all categories have at least one contribution
  const allCategoriesCovered = categoriesWithContributions === totalCategories;

  // Check if 75% of categories are covered
  const coveragePercent = categoriesWithContributions / totalCategories;
  const hasMinimumCoverage = coveragePercent >= MIN_COVERAGE_PERCENT;

  if (allCategoriesCovered) {
    return { 
      gateReady: true, 
      reason: `All ${totalCategories} experience categories covered with meaningful contributions` 
    };
  }

  if (hasDeepCoverage) {
    return { 
      gateReady: true, 
      reason: "Deep coverage achieved in at least one category (5+ contributions)" 
    };
  }

  if (hasMinimumCoverage) {
    return { 
      gateReady: true, 
      reason: `${Math.round(coveragePercent * 100)}% of categories covered (exceeds ${MIN_COVERAGE_PERCENT * 100}% threshold)` 
    };
  }

  return { 
    gateReady: false, 
    reason: `Only ${categoriesWithContributions}/${totalCategories} categories covered (need ${Math.ceil(totalCategories * MIN_COVERAGE_PERCENT)})` 
  };
}
