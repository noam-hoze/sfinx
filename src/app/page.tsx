"use client";

import React, { useState } from "react";
import GestureRecognizer from "./components/GestureRecognizer";
import MultiHandContour from "./components/MultiHandContour";
import Header from "./components/Header";

export default function Home() {
    const [showHandData, setShowHandData] = useState(true);

    const toggleHandData = () => {
        setShowHandData((prev) => !prev);
    };

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
                    justifyContent: "space-around",
                    width: "100%",
                    marginTop: "20px",
                }}
            >
                <GestureRecognizer />
                <MultiHandContour showData={showHandData} />
            </div>
        </main>
    );
}
