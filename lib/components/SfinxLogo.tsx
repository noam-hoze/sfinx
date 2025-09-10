"use client";

import Image from "next/image";
import React from "react";

interface SfinxLogoProps {
    width?: number;
    height?: number;
    className?: string;
    priority?: boolean;
}

export default function SfinxLogo({
    width = 180,
    height = 60,
    className = "w-[180px] h-auto object-contain",
    priority = false,
}: SfinxLogoProps) {
    return (
        <Image
            src="/logos/sfinx-logo.svg"
            alt="Sfinx Logo"
            width={width}
            height={height}
            className={className}
            priority={priority}
        />
    );
}
