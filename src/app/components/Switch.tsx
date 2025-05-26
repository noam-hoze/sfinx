"use client";

import React from "react";

interface SwitchProps {
    isOn: boolean;
    handleToggle: () => void;
    label?: string;
    labelColor?: string;
}

const Switch: React.FC<SwitchProps> = ({
    isOn,
    handleToggle,
    label,
    labelColor = "white",
}) => {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {label && (
                <span style={{ color: labelColor, fontSize: "0.9rem" }}>
                    {label}
                </span>
            )}
            <label
                style={{
                    position: "relative",
                    display: "inline-block",
                    width: "50px",
                    height: "28px",
                }}
            >
                <input
                    type="checkbox"
                    checked={isOn}
                    onChange={handleToggle}
                    style={{
                        opacity: 0,
                        width: 0,
                        height: 0,
                    }}
                />
                <span
                    style={{
                        position: "absolute",
                        cursor: "pointer",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: isOn ? "#4CAF50" : "#ccc", // Green when on, grey when off
                        transition: ".4s",
                        borderRadius: "28px",
                    }}
                >
                    <span
                        style={{
                            position: "absolute",
                            height: "20px",
                            width: "20px",
                            left: isOn ? "26px" : "4px", // Slider position
                            bottom: "4px",
                            backgroundColor: "white",
                            transition: ".4s",
                            borderRadius: "50%",
                        }}
                    />
                </span>
            </label>
        </div>
    );
};

export default Switch;
