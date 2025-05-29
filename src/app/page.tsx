"use client";

import React, { useState } from "react";
import GestureRecognizer from "./components/GestureRecognizer";
import MultiHandContour from "./components/MultiHandContour";
import Header from "./components/Header";

export default function Home() {
    const [showHandData, setShowHandData] = useState(true);
    const [isHeartRecognized, setIsHeartRecognized] = useState(false);
    const [noGodNoPosePlayTrigger, setNoGodNoPosePlayTrigger] = useState(0);

    const toggleHandData = () => {
        setShowHandData((prev) => !prev);
    };

    const handleHeartRecognized = (recognized: boolean) => {
        setIsHeartRecognized(recognized);
    };

    const handleNoGodNoPoseDetected = () => {
        console.log("page.tsx: handleNoGodNoPoseDetected called");
        setNoGodNoPosePlayTrigger((prev) => {
            const nextVal = prev + 1;
            console.log(
                `page.tsx: noGodNoPosePlayTrigger changing from ${prev} to ${nextVal}`
            );
            return nextVal;
        });
    };

    console.log(
        "page.tsx: Rendering with noGodNoPosePlayTrigger =",
        noGodNoPosePlayTrigger
    );
    return (
        <main
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                minHeight: "100vh",
            }}
        >
            <Header
                showHandData={showHandData}
                toggleHandData={toggleHandData}
            />
            <div
                style={{
                    display: "flex",
                    flexDirection: "row",
                    flexWrap: "wrap",
                    justifyContent: "center",
                    alignItems: "flex-start",
                    width: "100%",
                    marginTop: "20px",
                    gap: "20px",
                }}
            >
                <GestureRecognizer
                    onHeartRecognized={handleHeartRecognized}
                    onNoGodNoPoseDetected={handleNoGodNoPoseDetected}
                />
                <MultiHandContour
                    showData={showHandData}
                    isHeartTriggered={isHeartRecognized}
                    noGodNoPlayTrigger={noGodNoPosePlayTrigger}
                />
            </div>
        </main>
    );
}
