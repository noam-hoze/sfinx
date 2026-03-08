/**
 * Navigation hierarchy configuration for the application.
 * Defines parent-child relationships and breadcrumb labels.
 */

export interface NavParams {
  candidateName?: string;
  jobTitle?: string;
  companyName?: string;
}

export interface NavItem {
  label: string;
  parent?: string;
  breadcrumb: string | ((params: NavParams) => string);
}

export const COMPANY_NAV_HIERARCHY: Record<string, NavItem> = {
  "/company-dashboard": {
    label: "Applicants",
    breadcrumb: "Applicants"
  },
  "/cps": {
    label: "Candidate Profile",
    parent: "/company-dashboard",
    breadcrumb: (params: NavParams) => params.candidateName || "Candidate"
  },
  "/company-dashboard/jobs": {
    label: "Jobs",
    breadcrumb: "Jobs"
  },
  "/company-dashboard/jobs/[jobId]": {
    label: "Edit Job",
    parent: "/company-dashboard/jobs",
    breadcrumb: (params: NavParams) => params.jobTitle || "Edit Job"
  }
};

export const CANDIDATE_NAV_HIERARCHY: Record<string, NavItem> = {
  "/dashboard": {
    label: "Dashboard",
    breadcrumb: "Dashboard"
  },
  "/job-search": {
    label: "Jobs",
    parent: "/dashboard",
    breadcrumb: "Jobs"
  },
  "/interview": {
    label: "Interview",
    parent: "/job-search",
    breadcrumb: (params: NavParams) => 
      params.companyName && params.jobTitle 
        ? `${params.companyName} · ${params.jobTitle}`
        : "Interview"
  }
};

/**
 * Get the active navigation item for a given pathname.
 * Checks for exact match first, then checks parent hierarchy.
 */
export function getActiveNavItem(pathname: string, role: "COMPANY" | "CANDIDATE"): string {
  const hierarchy = role === "COMPANY" ? COMPANY_NAV_HIERARCHY : CANDIDATE_NAV_HIERARCHY;
  
  // Exact match
  if (hierarchy[pathname]) {
    return pathname;
  }
  
  // Check if current path is a child and return parent
  for (const [path, config] of Object.entries(hierarchy)) {
    if (pathname.startsWith(path.replace(/\[.*?\]/g, "")) && config.parent) {
      return config.parent;
    }
    
    // Handle dynamic routes like /company-dashboard/jobs/[jobId]
    const dynamicPattern = path.replace(/\[.*?\]/g, "[^/]+");
    const regex = new RegExp(`^${dynamicPattern}$`);
    if (regex.test(pathname)) {
      return config.parent || path;
    }
  }
  
  // Check parent relationships
  for (const [path, config] of Object.entries(hierarchy)) {
    if (config.parent && pathname === path) {
      return config.parent;
    }
  }
  
  return pathname;
}

/**
 * Build breadcrumb trail for a given pathname.
 */
export function getBreadcrumbTrail(
  pathname: string, 
  role: "COMPANY" | "CANDIDATE",
  params: NavParams = {}
): Array<{ label: string; href: string }> {
  const hierarchy = role === "COMPANY" ? COMPANY_NAV_HIERARCHY : CANDIDATE_NAV_HIERARCHY;
  const trail: Array<{ label: string; href: string }> = [];
  
  let currentPath = pathname;
  let matchedConfig: NavItem | undefined;
  
  // Find matching config (exact or dynamic)
  for (const [path, config] of Object.entries(hierarchy)) {
    const dynamicPattern = path.replace(/\[.*?\]/g, "[^/]+");
    const regex = new RegExp(`^${dynamicPattern}$`);
    if (pathname === path || regex.test(pathname)) {
      matchedConfig = config;
      currentPath = path;
      break;
    }
  }
  
  if (matchedConfig) {
    const label = typeof matchedConfig.breadcrumb === "function" 
      ? matchedConfig.breadcrumb(params)
      : matchedConfig.breadcrumb;
    
    trail.unshift({ label, href: pathname });
    
    // Walk up parent chain
    let parent = matchedConfig.parent;
    while (parent && hierarchy[parent]) {
      const parentConfig = hierarchy[parent];
      const parentLabel = typeof parentConfig.breadcrumb === "function"
        ? parentConfig.breadcrumb(params)
        : parentConfig.breadcrumb;
      
      trail.unshift({ label: parentLabel, href: parent });
      parent = parentConfig.parent;
    }
  }
  
  return trail;
}
