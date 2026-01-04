"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

/**
 * Apple-inspired breadcrumb navigation component.
 * Features frosted glass effect, smooth animations, and clean typography.
 */
export default function Breadcrumbs({ items, className = "" }: BreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <nav
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 backdrop-blur-md border border-white/20 shadow-sm ${className}`}
      aria-label="Breadcrumb"
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <React.Fragment key={item.href}>
            {index > 0 && (
              <ChevronRight
                className="w-3.5 h-3.5 text-gray-400 flex-shrink-0"
                strokeWidth={2}
              />
            )}
            {isLast ? (
              <span className="text-sm font-medium text-gray-900 whitespace-nowrap">
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors duration-200 whitespace-nowrap group"
              >
                <span className="relative">
                  {item.label}
                  <span className="absolute bottom-0 left-0 w-0 h-px bg-gray-900 transition-all duration-300 group-hover:w-full" />
                </span>
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

