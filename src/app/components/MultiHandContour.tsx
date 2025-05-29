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
    isHeartTriggered: boolean; // For the pink heart fill
    noGodNoPlayTrigger: number; // New prop to trigger the "No god no" video
}

const MultiHandContour: React.FC<MultiHandContourProps> = ({
    showData,
    isHeartTriggered,
    noGodNoPlayTrigger,
}) => {
    const webcamRef = useRef<Webcam>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const handLandmarkerRef = useRef<HandLandmarker | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const videoRef = useRef<HTMLVideoElement>(null); // Ref for the video element
    const [isVideoPlaying, setIsVideoPlaying] = useState(false);

    console.log(
        "MultiHandContour: Rendering with noGodNoPlayTrigger =",
        noGodNoPlayTrigger,
        "isVideoPlaying =",
        isVideoPlaying
    );

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
        console.log(
            "MultiHandContour: video trigger useEffect fired. noGodNoPlayTrigger:",
            noGodNoPlayTrigger
        );
        if (videoRef.current) {
            console.log(
                `MultiHandContour: Conditions check: !isVideoPlaying (${!isVideoPlaying}), videoRef.current.ended: ${
                    videoRef.current.ended
                }`
            );
        }

        // Simplified condition: Play if triggered and not already considered playing by our state.
        // The onEnded event will reset isVideoPlaying, allowing the next trigger.
        if (noGodNoPlayTrigger > 0 && videoRef.current && !isVideoPlaying) {
            console.log("MultiHandContour: Attempting to play video...");
            videoRef.current.currentTime = 0;
            videoRef.current
                .play()
                .then(() => {
                    console.log("MultiHandContour: Video playback started.");
                    setIsVideoPlaying(true);
                })
                .catch((error) => {
                    console.error(
                        "MultiHandContour: Error playing video:",
                        error
                    );
                    setIsVideoPlaying(false);
                });
        }
    }, [noGodNoPlayTrigger]); // Dependency array is correct, only trigger on new pose signal

    const handleVideoEnded = () => {
        console.log("MultiHandContour: Video ended.");
        setIsVideoPlaying(false);
    };

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

            // Pink Heart Fill Logic (when showData is OFF and heart is triggered from recognizer)
            if (
                results.landmarks?.length === 2 &&
                !showData &&
                isHeartTriggered
            ) {
                const [handA, handB] = results.landmarks;
                const isA_left = handA[0].x < handB[0].x;
                const leftHand = isA_left ? handA : handB;
                const rightHand = isA_left ? handB : handA;
                const scale = (pt: { x: number; y: number; z?: number }) => [
                    pt.x * VIDEO_WIDTH,
                    pt.y * VIDEO_HEIGHT,
                ];
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
                    ctx.fillStyle = "hotpink";
                    ctx.beginPath();
                    const [startX, startY] = heartPath[0];
                    ctx.moveTo(startX, startY);
                    heartPath.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
                    ctx.closePath();
                    ctx.fill();
                }
            }

            // Draw debug data if showData is ON
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
                    const contourIndices = [0, 5, 9, 13, 17];
                    ctx.beginPath();
                    const firstContourPoint = landmarks[contourIndices[0]];
                    if (firstContourPoint) {
                        ctx.moveTo(
                            firstContourPoint.x * VIDEO_WIDTH,
                            firstContourPoint.y * VIDEO_HEIGHT
                        );
                        for (let i = 1; i < contourIndices.length; i++) {
                            const point = landmarks[contourIndices[i]];
                            if (point) {
                                ctx.lineTo(
                                    point.x * VIDEO_WIDTH,
                                    point.y * VIDEO_HEIGHT
                                );
                            }
                        }
                        ctx.closePath();
                        ctx.fill();
                        ctx.stroke();
                    }
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
    }, [isLoading, showData, isHeartTriggered, isVideoPlaying]); // Added isVideoPlaying

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
                <video
                    ref={videoRef}
                    src="/vfx/no_god_no_cut.mp4"
                    onEnded={handleVideoEnded}
                    style={{
                        display: isVideoPlaying ? "block" : "none",
                        position: "absolute",
                        top: "235px",
                        right: "3px",
                        width: "320px",
                        height: "auto",
                        zIndex: 20,
                        border: "1px solid yellow",
                    }}
                    playsInline
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
