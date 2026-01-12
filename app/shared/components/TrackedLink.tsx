"use client";

import { usePathname, useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import { setNavigationSource } from "@/shared/state/slices/navigationSlice";
import { ReactNode, MouseEvent } from "react";

interface TrackedLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
}

/**
 * Link component that tracks navigation source for breadcrumb generation
 */
export function TrackedLink({ href, children, className, onClick }: TrackedLinkProps) {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useDispatch();

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    
    // Track current path as navigation source in Redux
    dispatch(setNavigationSource(pathname));
    
    // Call custom onClick if provided
    if (onClick) {
      onClick(e);
    }
    
    // Navigate to href
    router.push(href);
  };

  return (
    <a href={href} className={className} onClick={handleClick}>
      {children}
    </a>
  );
}
