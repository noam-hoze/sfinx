"use client";

import React, { useRef, useEffect, useState } from "react";
import Webcam from "react-webcam";
import * as tf from "@tensorflow/tfjs";
// @ts-ignore
import * as handpose from "@tensorflow-models/handpose";
// It's good practice to explicitly import a backend for tfjs.
// You might need to install this: npm install @tensorflow/tfjs-backend-webgl
// import '@tensorflow/tfjs-backend-webgl';

const WEBCAM_WIDTH = 640;
const WEBCAM_HEIGHT = 480;

// Landmark indices for the outer contour of the hand (thumb base, pinky base, middle finger base - simplified)
// For a more accurate outer contour, you might need more points or a different strategy
// Handpose provides 21 landmarks. An approximate outer contour could be:
// 0 (wrist), 1 (thumb_cmc), 5 (index_finger_mcp), 9 (middle_finger_mcp), 13 (ring_finger_mcp), 17 (pinky_mcp)
const HAND_CONTOUR_LANDMARKS = [0, 5, 9, 13, 17]; // Points forming the outer shape

interface HandContourProps {
    // Props can be added here if needed, e.g., color, transparency
}

const HandContour: React.FC<HandContourProps> = () => {
    const webcamRef = useRef<Webcam>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const modelRef = useRef<handpose.HandPose | null>(null);
    const requestRef = useRef<number | null>(null);
    const [isLoadingModel, setIsLoadingModel] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // 1. Load Handpose Model
    useEffect(() => {
        const loadModel = async () => {
            try {
                await tf.ready(); // Ensure tf is ready
                // Optional: Set a specific backend
                // await tf.setBackend('webgl');
                // console.log('TensorFlow.js backend:', tf.getBackend());

                const loadedModel = await handpose.load();
                modelRef.current = loadedModel;
                setIsLoadingModel(false);
                console.log("Handpose model loaded successfully.");
            } catch (err: any) {
                console.error("Error loading Handpose model:", err);
                setError(
                    `Failed to load handpose model: ${
                        err.message || "Unknown error"
                    }`
                );
                setIsLoadingModel(false);
            }
        };
        loadModel();

        return () => {
            console.log("HandContour component unmounting.");
            if (requestRef.current) {
                cancelAnimationFrame(requestRef.current);
            }
            // modelRef.current?.dispose(); // handpose model might not have dispose, or tf.tidy might be better
        };
    }, []);

    // 2. Detection and Drawing Loop
    useEffect(() => {
        const detectHands = async () => {
            if (
                !modelRef.current ||
                isLoadingModel ||
                !webcamRef.current ||
                !webcamRef.current.video ||
                webcamRef.current.video.readyState !== 4 || // video is ready and playing
                !canvasRef.current
            ) {
                // If model is loaded but other conditions not met, still request next frame to keep trying
                if (modelRef.current && !isLoadingModel) {
                    requestRef.current = requestAnimationFrame(detectHands);
                }
                return;
            }

            const video = webcamRef.current.video;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext("2d");

            if (!ctx) {
                console.error("Failed to get 2D context from canvas");
                requestRef.current = requestAnimationFrame(detectHands);
                return;
            }

            // Set canvas dimensions to match video to ensure correct coordinate mapping
            if (
                canvas.width !== video.videoWidth ||
                canvas.height !== video.videoHeight
            ) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
            }

            try {
                const predictions = await modelRef.current.estimateHands(
                    video,
                    false
                ); // false: don't flipHorizontal for webcam

                ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas

                if (predictions.length > 0) {
                    predictions.forEach((prediction) => {
                        const landmarks = prediction.landmarks as [
                            number,
                            number,
                            number
                        ][]; // Each landmark is [x, y, z]

                        // Draw all 21 keypoints
                        ctx.fillStyle = "red";
                        for (let i = 0; i < landmarks.length; i++) {
                            const x = canvas.width - landmarks[i][0];
                            const y = landmarks[i][1];
                            ctx.beginPath();
                            ctx.arc(x, y, 5, 0, 2 * Math.PI);
                            ctx.fill();
                        }

                        // Draw and fill the outer contour polygon
                        if (HAND_CONTOUR_LANDMARKS.length > 2) {
                            ctx.beginPath();
                            const firstPoint =
                                landmarks[HAND_CONTOUR_LANDMARKS[0]];
                            ctx.moveTo(
                                canvas.width - firstPoint[0],
                                firstPoint[1]
                            );

                            for (
                                let i = 1;
                                i < HAND_CONTOUR_LANDMARKS.length;
                                i++
                            ) {
                                const landmarkIndex = HAND_CONTOUR_LANDMARKS[i];
                                if (landmarks[landmarkIndex]) {
                                    const point = landmarks[landmarkIndex];
                                    ctx.lineTo(
                                        canvas.width - point[0],
                                        point[1]
                                    );
                                }
                            }
                            ctx.closePath(); // Close the polygon path

                            ctx.fillStyle = "rgba(0, 255, 0, 0.3)"; // Semi-transparent green
                            ctx.fill();
                            ctx.strokeStyle = "green"; // Outline color
                            ctx.lineWidth = 2;
                            ctx.stroke();
                        }
                    });
                }
            } catch (err: any) {
                console.error("Error during hand detection:", err);
                setError(
                    `Error during hand detection: ${
                        err.message || "Unknown error"
                    }`
                );
                // Potentially stop the loop or handle error appropriately
            }

            requestRef.current = requestAnimationFrame(detectHands);
        };

        if (!isLoadingModel) {
            requestRef.current = requestAnimationFrame(detectHands);
        }

        // Cleanup this effect
        return () => {
            if (requestRef.current) {
                cancelAnimationFrame(requestRef.current);
            }
        };
    }, [isLoadingModel]); // Rerun effect if isLoadingModel changes

    if (error) {
        return (
            <div style={{ color: "red", padding: "20px" }}>Error: {error}</div>
        );
    }

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "20px",
            }}
        >
            <h1>Hand Contour Detection (TensorFlow.js Handpose)</h1>
            {isLoadingModel && <p>Loading Handpose model, please wait...</p>}
            <div
                style={{
                    position: "relative",
                    width: `${WEBCAM_WIDTH}px`,
                    height: `${WEBCAM_HEIGHT}px`,
                }}
            >
                <Webcam
                    ref={webcamRef}
                    muted={true}
                    audio={false}
                    width={WEBCAM_WIDTH}
                    height={WEBCAM_HEIGHT}
                    videoConstraints={{
                        width: WEBCAM_WIDTH,
                        height: WEBCAM_HEIGHT,
                        facingMode: "user",
                    }}
                    mirrored={true}
                    forceScreenshotSourceSize={false}
                    imageSmoothing={true}
                    disablePictureInPicture={true}
                    screenshotFormat="image/webp"
                    screenshotQuality={0.92}
                    style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        width: `${WEBCAM_WIDTH}px`,
                        height: `${WEBCAM_HEIGHT}px`,
                        border: "1px solid lightgray",
                    }}
                    onUserMediaError={(err) => {
                        console.error("Webcam access error:", err);
                        setError(
                            "Failed to access webcam. Please ensure permissions are granted."
                        );
                    }}
                    onUserMedia={() => {
                        console.log("Webcam access granted.");
                        setError(null); // Clear any previous webcam errors
                    }}
                />
                <canvas
                    ref={canvasRef}
                    style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        width: `${WEBCAM_WIDTH}px`,
                        height: `${WEBCAM_HEIGHT}px`,
                        pointerEvents: "none", // Allows webcam interaction if needed
                    }}
                />
            </div>
            {!isLoadingModel && (
                <p style={{ marginTop: "10px" }}>
                    Handpose model loaded. Try showing your hand!
                </p>
            )}
        </div>
    );
};

export default HandContour;
