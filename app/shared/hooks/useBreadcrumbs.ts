import { usePathname } from "next/navigation";
import { useSelector } from "react-redux";
import { selectBreadcrumbSource } from "@/shared/state/slices/navigationSlice";
import { breadcrumbConfig, resolveParentBreadcrumb } from "../config/breadcrumbs";

export interface BreadcrumbItem {
  label: string;
  href: string;
}

/**
 * Hook to generate breadcrumbs based on current route and navigation history
 */
export function useBreadcrumbs(overrides?: {
  currentLabel?: string;
  currentHref?: string;
}): BreadcrumbItem[] {
  const pathname = usePathname();
  const breadcrumbSource = useSelector(selectBreadcrumbSource);

  // Normalize path for pattern matching (replace dynamic segments like /applicants/any-slug with /applicants/[jobId])
  const normalizedPath = pathname.replace(/\/applicants\/[^/]+$/, "/applicants/[jobId]")
    .replace(/\/company-dashboard$/, "/company-dashboard");

  const config = breadcrumbConfig[normalizedPath];
  
  if (!config) {
    // No config found, return simple breadcrumb
    return [];
  }

  const breadcrumbs: BreadcrumbItem[] = [];

  // Add parent breadcrumb if exists
  const parent = resolveParentBreadcrumb(
    pathname,
    breadcrumbSource,
    config
  );

  if (parent) {
    breadcrumbs.push(parent);
  }

  // Add current page breadcrumb
  breadcrumbs.push({
    label: overrides?.currentLabel || config.label,
    href: overrides?.currentHref || pathname,
  });

  return breadcrumbs;
}
