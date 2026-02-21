/**
 * DashboardCard: Reusable card component with spring hover effects and squircle corners.
 */

"use client";

import React from "react";
import { motion } from "framer-motion";

interface DashboardCardProps {
    onClick?: () => void;
    children: React.ReactNode;
    className?: string;
}

const springHover = { type: "spring", stiffness: 400, damping: 25 } as const;

export default function DashboardCard({
    onClick,
    children,
    className = "",
}: DashboardCardProps) {
    const baseClasses = `glass-card rounded-squircle p-6 ${className}`.trim();

    if (onClick) {
        return (
            <motion.button
                onClick={onClick}
                className={`${baseClasses} text-left w-full`}
                type="button"
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                transition={springHover}
            >
                {children}
            </motion.button>
        );
    }

    return (
        <motion.div
            className={baseClasses}
            whileHover={{ scale: 1.01, y: -1 }}
            transition={springHover}
        >
            {children}
        </motion.div>
    );
}
