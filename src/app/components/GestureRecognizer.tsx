"use client";

import React, { useRef, useEffect, useState } from "react";
import Webcam from "react-webcam";
import * as tmPose from "@teachablemachine/pose";
import * as tf from "@tensorflow/tfjs";

interface GestureRecognizerProps {
    onHeartRecognized: (recognized: boolean) => void;
    onNoGodNoPoseDetected: () => void;
}

const GestureRecognizer: React.FC<GestureRecognizerProps> = ({
    onHeartRecognized,
    onNoGodNoPoseDetected,
}) => {
    const webcamRef = useRef<Webcam>(null);
    const modelRef = useRef<tmPose.CustomPoseNet | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [prediction, setPrediction] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [lastSoundPlayTime, setLastSoundPlayTime] = useState<number>(0);
    const [isHeartGestureActive, setIsHeartGestureActive] =
        useState<boolean>(false);
    const [wasNoGodNoPosePreviouslyActive, setWasNoGodNoPosePreviouslyActive] =
        useState<boolean>(false);

    const modelURL = "/my-pose-model/model.json";
    const metadataURL = "/my-pose-model/metadata.json";
    const heartSoundURL = "/sounds/love_short.mp3";

    const HEART_GESTURE_CLASS = "Heart";
    const NO_GOD_NO_GESTURE_CLASS = "No god no";
    const CONFIDENCE_THRESHOLD = 0.85;
    const HEART_SOUND_DEBOUNCE_MS = 1000;

    useEffect(() => {
        const loadModel = async () => {
            try {
                await tf.ready();
                console.log("TensorFlow.js ready.");
                const loadedModel = await tmPose.load(modelURL, metadataURL);
                modelRef.current = loadedModel;
                console.log("Pose Model loaded successfully");
                setIsLoading(false);
            } catch (error) {
                console.error("Error loading pose model:", error);
                setIsLoading(false);
            }
        };
        loadModel();

        return () => {
            console.log("GestureRecognizer component unmounted");
            audioRef.current?.pause();
            audioRef.current = null;
        };
    }, []);

    useEffect(() => {
        const predictGesture = async () => {
            if (
                !modelRef.current ||
                !webcamRef.current ||
                !webcamRef.current.video ||
                webcamRef.current.video.readyState !== 4
            ) {
                return;
            }

            const video = webcamRef.current.video as HTMLVideoElement;
            const { pose, posenetOutput } = await modelRef.current.estimatePose(
                video
            );

            let detectedGestureClass: string | null = null;
            let highestProb = 0;

            if (pose) {
                const predictionResult = await modelRef.current.predict(
                    posenetOutput
                );
                for (const pred of predictionResult) {
                    if (pred.probability > highestProb) {
                        highestProb = pred.probability;
                        detectedGestureClass = pred.className;
                    }
                }
                console.log(
                    `Detected: ${detectedGestureClass}, Confidence: ${highestProb.toFixed(
                        4
                    )}`
                );
                setPrediction(
                    detectedGestureClass
                        ? `${detectedGestureClass} (${(
                              highestProb * 100
                          ).toFixed(2)}%)`
                        : "No gesture detected"
                );
            } else {
                setPrediction("No pose detected");
            }

            const isCurrentlyHeart =
                detectedGestureClass === HEART_GESTURE_CLASS &&
                highestProb > CONFIDENCE_THRESHOLD;
            if (isHeartGestureActive !== isCurrentlyHeart) {
                setIsHeartGestureActive(isCurrentlyHeart);
                onHeartRecognized(isCurrentlyHeart);
                if (isCurrentlyHeart) {
                    const now = Date.now();
                    if (now - lastSoundPlayTime > HEART_SOUND_DEBOUNCE_MS) {
                        if (!audioRef.current || audioRef.current.ended) {
                            audioRef.current = new Audio(heartSoundURL);
                            audioRef.current
                                .play()
                                .catch((e) =>
                                    console.error(
                                        "Error playing heart sound:",
                                        e
                                    )
                                );
                            setLastSoundPlayTime(now);
                        }
                    }
                }
            }

            const isCurrentlyNoGodNo =
                detectedGestureClass === NO_GOD_NO_GESTURE_CLASS &&
                highestProb > CONFIDENCE_THRESHOLD;
            if (isCurrentlyNoGodNo && !wasNoGodNoPosePreviouslyActive) {
                onNoGodNoPoseDetected();
            }
            setWasNoGodNoPosePreviouslyActive(isCurrentlyNoGodNo);
        };

        const intervalId = setInterval(() => {
            if (!isLoading) {
                predictGesture();
            }
        }, 200);

        return () => {
            clearInterval(intervalId);
            if (isHeartGestureActive) onHeartRecognized(false);
        };
    }, [
        isLoading,
        lastSoundPlayTime,
        isHeartGestureActive,
        wasNoGodNoPosePreviouslyActive,
        onHeartRecognized,
        onNoGodNoPoseDetected,
    ]);

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
            }}
        >
            <h1>SFX Generator</h1>
            {isLoading && <p>Loading model...</p>}
            <Webcam
                ref={webcamRef}
                muted={true}
                mirrored
                style={{
                    width: "640px",
                    height: "480px",
                    border: "1px solid black",
                }}
                videoConstraints={{
                    width: 640,
                    height: 480,
                    facingMode: "user",
                }}
                onUserMediaError={(err) => console.error("Webcam error:", err)}
                onUserMedia={() => console.log("Webcam access granted")}
            />
            {prediction && (
                <p style={{ marginTop: "10px", fontSize: "1.2em" }}>
                    Prediction: {prediction}
                </p>
            )}
        </div>
    );
};

export default GestureRecognizer;
