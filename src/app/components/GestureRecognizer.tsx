"use client";

import React, { useRef, useEffect, useState } from "react";
import Webcam from "react-webcam";
import * as tmPose from "@teachablemachine/pose";
import * as tf from "@tensorflow/tfjs";

const GestureRecognizer: React.FC = () => {
    const webcamRef = useRef<Webcam>(null);
    const modelRef = useRef<tmPose.CustomPoseNet | null>(null);
    const [prediction, setPrediction] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [lastSoundPlayTime, setLastSoundPlayTime] = useState<number>(0);
    const [isGestureDetected, setIsGestureDetected] = useState<boolean>(false);

    const modelURL = "/my-pose-model/model.json";
    const metadataURL = "/my-pose-model/metadata.json";
    const soundURL = "/sounds/FL_LH_KIT02_90BPM_Chimes.wav";
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const GESTURE_CLASS_NAME = "Heart";
    const CONFIDENCE_THRESHOLD = 0.9;
    const DEBOUNCE_TIME_MS = 1000;

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

        if (typeof Audio !== "undefined") {
            audioRef.current = new Audio(soundURL);
        }

        return () => {
            console.log("GestureRecognizer component unmounted");
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
            if (pose) {
                const predictionResult = await modelRef.current.predict(
                    posenetOutput
                );

                let highestProb = 0;
                let detectedGesture = null;

                for (const pred of predictionResult) {
                    if (pred.probability > highestProb) {
                        highestProb = pred.probability;
                        detectedGesture = pred.className;
                    }
                }

                if (detectedGesture) {
                    setPrediction(
                        `${detectedGesture} (${(highestProb * 100).toFixed(
                            2
                        )}%)`
                    );
                } else {
                    setPrediction("No gesture detected");
                }

                if (
                    detectedGesture === GESTURE_CLASS_NAME &&
                    highestProb > CONFIDENCE_THRESHOLD
                ) {
                    if (!isGestureDetected) {
                        const now = Date.now();
                        if (now - lastSoundPlayTime > DEBOUNCE_TIME_MS) {
                            if (audioRef.current) {
                                audioRef.current
                                    .play()
                                    .catch((e) =>
                                        console.error("Error playing sound:", e)
                                    );
                            }
                            setLastSoundPlayTime(now);
                        }
                    }
                    setIsGestureDetected(true);
                } else {
                    if (isGestureDetected) {
                        setLastSoundPlayTime(0);
                    }
                    setIsGestureDetected(false);
                }
            } else {
                setPrediction("No pose detected");
            }
        };

        const intervalId = setInterval(() => {
            if (!isLoading) {
                predictGesture();
            }
        }, 200);

        return () => clearInterval(intervalId);
    }, [
        isLoading,
        lastSoundPlayTime,
        isGestureDetected,
        GESTURE_CLASS_NAME,
        CONFIDENCE_THRESHOLD,
        DEBOUNCE_TIME_MS,
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
