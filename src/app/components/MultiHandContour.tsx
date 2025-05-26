"use client";

import React, { useRef, useEffect, useState } from "react";
import Webcam from "react-webcam";
import {
    FilesetResolver,
    HandLandmarker,
    HandLandmarkerResult,
} from "@mediapipe/tasks-vision";

const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 480;

interface MultiHandContourProps {
    showData: boolean;
}

const MultiHandContour: React.FC<MultiHandContourProps> = ({ showData }) => {
    const webcamRef = useRef<Webcam>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const handLandmarkerRef = useRef<HandLandmarker | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const init = async () => {
            const filesetResolver = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.12/wasm"
            );

            const handLandmarker = await HandLandmarker.createFromOptions(
                filesetResolver,
                {
                    baseOptions: {
                        modelAssetPath:
                            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                        delegate: "GPU",
                    },
                    runningMode: "VIDEO",
                    numHands: 2,
                }
            );

            handLandmarkerRef.current = handLandmarker;
            setIsLoading(false);
        };

        init();

        return () => {
            handLandmarkerRef.current?.close();
        };
    }, []);

    useEffect(() => {
        let animationId: number;

        const detect = async () => {
            if (
                !handLandmarkerRef.current ||
                !webcamRef.current?.video ||
                webcamRef.current.video.readyState < 2 ||
                !canvasRef.current
            ) {
                animationId = requestAnimationFrame(detect);
                return;
            }

            const video = webcamRef.current.video;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext("2d");

            if (!ctx) {
                console.error("Failed to get 2D context from canvas");
                animationId = requestAnimationFrame(detect);
                return;
            }

            canvas.width = VIDEO_WIDTH;
            canvas.height = VIDEO_HEIGHT;

            const now = performance.now();
            const results = handLandmarkerRef.current.detectForVideo(
                video,
                now
            );

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Mirror canvas to match webcam
            ctx.save();
            ctx.scale(-1, 1);
            ctx.translate(-canvas.width, 0);

            // Styles for contour
            ctx.strokeStyle = "lime"; // For contour outline
            // FillStyle will be set specifically for landmarks and then for contour
            ctx.lineWidth = 2;

            if (showData) {
                results.landmarks?.forEach((landmarks) => {
                    // Draw landmarks (red dots)
                    ctx.fillStyle = "red"; // Set fill to red for landmarks
                    landmarks.forEach((landmark) => {
                        const x = landmark.x * VIDEO_WIDTH;
                        const y = landmark.y * VIDEO_HEIGHT;
                        ctx.beginPath();
                        ctx.arc(x, y, 4, 0, 2 * Math.PI);
                        ctx.fill();
                    });

                    // Draw contour polygon (green fill)
                    ctx.fillStyle = "rgba(0,255,0,0.2)"; // Set fill to green for contour
                    const indices = [0, 5, 9, 13, 17];
                    ctx.beginPath();
                    const first = landmarks[indices[0]];
                    ctx.moveTo(first.x * VIDEO_WIDTH, first.y * VIDEO_HEIGHT);
                    for (let i = 1; i < indices.length; i++) {
                        const point = landmarks[indices[i]];
                        ctx.lineTo(
                            point.x * VIDEO_WIDTH,
                            point.y * VIDEO_HEIGHT
                        );
                    }
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                });

                // === HEART SHAPE FILL — minimal top loop ===
                if (results.landmarks?.length === 2) {
                    const [handA, handB] = results.landmarks;

                    const isA_left = handA[0].x < handB[0].x;
                    const leftHand = isA_left ? handA : handB;
                    const rightHand = isA_left ? handB : handA;

                    const scale = (pt: {
                        x: number;
                        y: number;
                        z?: number;
                    }) => [pt.x * VIDEO_WIDTH, pt.y * VIDEO_HEIGHT];

                    // Check if all necessary landmarks exist for the minimal top loop
                    const requiredHeartLoopIndices = [4, 5, 6, 7, 8];
                    const allHeartLoopLandmarksPresent =
                        requiredHeartLoopIndices.every(
                            (idx) => leftHand[idx] && rightHand[idx]
                        );

                    if (allHeartLoopLandmarksPresent) {
                        const leftPathPoints = [8, 7, 6, 5, 4].map((i) =>
                            scale(leftHand[i])
                        );
                        const rightPathPoints = [4, 5, 6, 7, 8].map((i) =>
                            scale(rightHand[i])
                        );

                        const heartPath = [
                            ...leftPathPoints,
                            ...rightPathPoints.reverse(),
                        ];

                        ctx.fillStyle = "rgba(255, 0, 0, 0.4)";
                        ctx.strokeStyle = "red";
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        const [startX, startY] = heartPath[0]; // heartPath[0] is already an array [x,y]
                        ctx.moveTo(startX, startY);
                        heartPath
                            .slice(1)
                            .forEach(([x, y]) => ctx.lineTo(x, y));
                        ctx.closePath();
                        ctx.fill();
                        ctx.stroke();
                    } else {
                        // console.log("Minimal top loop heart landmarks not complete.");
                    }
                }
            }

            ctx.restore(); // Stop mirroring

            animationId = requestAnimationFrame(detect);
        };

        if (!isLoading) animationId = requestAnimationFrame(detect);

        return () => cancelAnimationFrame(animationId);
    }, [isLoading, showData]);

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                position: "relative",
                width: VIDEO_WIDTH,
                height: VIDEO_HEIGHT + 50,
            }}
        >
            <h1>VFX Generator</h1>
            <div
                style={{
                    position: "relative",
                    width: VIDEO_WIDTH,
                    height: VIDEO_HEIGHT,
                }}
            >
                <Webcam
                    ref={webcamRef}
                    width={VIDEO_WIDTH}
                    height={VIDEO_HEIGHT}
                    mirrored
                    videoConstraints={{
                        width: VIDEO_WIDTH,
                        height: VIDEO_HEIGHT,
                        facingMode: "user",
                    }}
                    style={{ position: "absolute", top: 0, left: 0 }}
                />
                <canvas
                    ref={canvasRef}
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        pointerEvents: "none",
                    }}
                />
                {isLoading && (
                    <p style={{ position: "absolute", top: 0, color: "white" }}>
                        Loading model…
                    </p>
                )}
            </div>
        </div>
    );
};

export default MultiHandContour;
