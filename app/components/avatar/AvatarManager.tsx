"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import AvatarDisplay from "./AvatarDisplay";
import { useInterview } from "../../../lib/interview/context";

const AvatarManager: React.FC = () => {
    const {
        state,
        hideAvatar,
        updateAvatarPosition,
        showAvatar,
        startAvatarSpeaking,
        stopAvatarSpeaking,
    } = useInterview();
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const avatarRef = useRef<HTMLDivElement>(null);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!avatarRef.current) return;

        setIsDragging(true);
        const rect = avatarRef.current.getBoundingClientRect();
        setDragOffset({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        });
    };

    const handleMouseMove = useCallback(
        (e: MouseEvent) => {
            if (!isDragging || !avatarRef.current) return;

            const newX = e.clientX - dragOffset.x;
            const newY = e.clientY - dragOffset.y;

            // Allow unlimited dragging - no bounds constraints
            updateAvatarPosition(newX, newY);
        },
        [isDragging, dragOffset.x, dragOffset.y, updateAvatarPosition]
    );

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    useEffect(() => {
        if (isDragging) {
            document.addEventListener("mousemove", handleMouseMove);
            document.addEventListener("mouseup", handleMouseUp);
        }

        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);

    if (!state.avatarVisible) {
        return null;
    }

    return (
        <div
            ref={avatarRef}
            className="fixed z-[9999] cursor-move select-none"
            style={{
                left: `${state.avatarPosition.x}px`,
                top: `${state.avatarPosition.y}px`,
                width: "300px",
                height: "900px",
            }}
            onMouseDown={handleMouseDown}
        >
            {/* Close button */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    hideAvatar();
                }}
                className="absolute top-2 right-2 z-10 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-sm transition-colors opacity-70 hover:opacity-100"
                title="Close Avatar"
            >
                <X size={16} />
            </button>

            {/* Avatar Display - no container, just the 3D model */}
            <div className="w-full h-full">
                <AvatarDisplay
                    className="w-full h-full"
                    isSpeaking={state.isAvatarSpeaking}
                />
            </div>
        </div>
    );
};

export default AvatarManager;
