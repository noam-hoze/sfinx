"use client";

import React from "react";
import MultiHandContour from "../components/MultiHandContour"; // Corrected path

export default function MultiHandPage() {
    return (
        <main>
            <h1>Multi-Hand Landmark Detection Demo</h1>
            <div
                
                style={{ width: "auto", height: "auto" }} // Let the component define its size
            >
                <MultiHandContour />
            </div>
            <p style={{ marginTop: "20px", textAlign: "center" }}>
                This page uses MediaPipe HandLandmarker to detect and draw
                contours for up to two hands.
            </p>
        </main>
    );
}
