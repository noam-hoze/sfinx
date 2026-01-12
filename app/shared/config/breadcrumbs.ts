/**
 * Breadcrumb configuration for the application.
 * Defines parent-child relationships and possible navigation sources.
 */

export interface BreadcrumbConfig {
  label: string;
  href: string;
  possibleParents?: {
    pathPattern: string;
    label: string;
    href: string;
  }[];
}

export const breadcrumbConfig: Record<string, BreadcrumbConfig> = {
  // Jobs section
  "/company-dashboard/jobs": {
    label: "Jobs",
    href: "/company-dashboard/jobs",
  },

  // Applicants overview
  "/company-dashboard": {
    label: "Applicants",
    href: "/company-dashboard",
  },

  // Job-specific applicants page
  "/company-dashboard/applicants/[jobId]": {
    label: "", // Will be filled dynamically with job title
    href: "", // Will be filled dynamically
    possibleParents: [
      {
        pathPattern: "/company-dashboard/jobs",
        label: "Jobs",
        href: "/company-dashboard/jobs",
      },
      {
        pathPattern: "/company-dashboard",
        label: "Applicants",
        href: "/company-dashboard",
      },
    ],
  },
};

/**
 * Determines the appropriate parent breadcrumb based on navigation history
 */
export function resolveParentBreadcrumb(
  currentPath: string,
  previousPath: string | null,
  config: BreadcrumbConfig
): { label: string; href: string } | null {
  if (!config.possibleParents || config.possibleParents.length === 0) {
    return null;
  }

  // If we have previous path, match it against possible parents
  if (previousPath) {
    for (const parent of config.possibleParents) {
      if (previousPath.startsWith(parent.pathPattern)) {
        return { label: parent.label, href: parent.href };
      }
    }
  }

  // Default to first parent
  return config.possibleParents[0];
}
