"use client";

import React, { Suspense, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";

interface AvatarModelProps {
    avatarUrl: string;
    isSpeaking: boolean;
}

function AvatarModel({ avatarUrl, isSpeaking }: AvatarModelProps) {
    const groupRef = useRef<THREE.Group>(null);

    // Load the GLTF/GLB model - this returns a promise initially, then the actual object
    const gltf = useGLTF(avatarUrl);

    // Clone the scene to avoid mutations - handle loading state
    const clonedScene = gltf?.scene ? gltf.scene.clone() : null;

    React.useEffect(() => {
        if (clonedScene) {
            console.log("Avatar loaded successfully:", avatarUrl);

            // Scale and position the avatar for front-facing view
            clonedScene.scale.setScalar(1.8);
            clonedScene.position.set(0, 0.5, 0);

            console.log(
                "🎭 AVATAR POSITIONED - Scale:",
                clonedScene.scale.x,
                "Position Y:",
                clonedScene.position.y,
                "Scene position:",
                clonedScene.position
            );

            // Force update the matrix
            clonedScene.updateMatrix();
            clonedScene.updateMatrixWorld(true);

            // Debug: Add visible indicator at avatar position
            const debugCube = new THREE.Mesh(
                new THREE.BoxGeometry(0.2, 0.2, 0.2),
                new THREE.MeshBasicMaterial({ color: 0x00ff00 })
            );
            debugCube.position.set(0, 1.5, 0); // Position at head level
            clonedScene.add(debugCube);

            // Traverse and set material properties for better rendering
            clonedScene.traverse((child: THREE.Object3D) => {
                if (child instanceof THREE.Mesh) {
                    const mesh = child as THREE.Mesh;
                    if (mesh.material) {
                        if (Array.isArray(mesh.material)) {
                            mesh.material = mesh.material.map((mat) =>
                                mat.clone()
                            );
                        } else {
                            mesh.material = mesh.material.clone();
                        }
                        if (
                            mesh.material instanceof THREE.MeshStandardMaterial
                        ) {
                            mesh.material.needsUpdate = true;
                        }
                    }
                }
            });
        }
    }, [clonedScene, avatarUrl]);

    // Handle loading state
    if (!clonedScene) {
        console.log("Avatar still loading...", avatarUrl);
        return (
            <mesh position={[0, -1, 0]}>
                <boxGeometry args={[0.5, 1.5, 0.3]} />
                <meshStandardMaterial color="gray" />
            </mesh>
        );
    }

    return (
        <LipSyncAvatar
            scene={clonedScene}
            isSpeaking={isSpeaking}
            ref={groupRef}
        />
    );
}

interface LipSyncAvatarProps {
    scene: THREE.Group;
    isSpeaking: boolean;
}

const LipSyncAvatar = React.forwardRef<THREE.Group, LipSyncAvatarProps>(
    ({ scene, isSpeaking }, ref) => {
        const [mouthOpen, setMouthOpen] = React.useState(0);
        const [headTilt, setHeadTilt] = React.useState(0);
        const [eyeBlink, setEyeBlink] = React.useState(0);

        // Real-time lip sync with audio analysis
        React.useEffect(() => {
            if (!isSpeaking) {
                setMouthOpen(0);
                setHeadTilt(0);
                setEyeBlink(0);
                return;
            }

            // Create audio context for real-time analysis
            const audioContext = new (window.AudioContext ||
                (window as any).webkitAudioContext)();
            const analyser = audioContext.createAnalyser();
            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            // Find audio element playing the TTS
            const findAudioElement = () => {
                const audioElements = document.querySelectorAll("audio");
                for (const audio of audioElements) {
                    // Check if audio is actively playing (not paused, not ended, and has started)
                    if (
                        !audio.paused &&
                        !audio.ended &&
                        audio.currentTime > 0 &&
                        audio.currentTime < audio.duration
                    ) {
                        return audio;
                    }
                }
                return null;
            };

            // Connect to audio for analysis
            const connectToAudio = () => {
                const audioElement = findAudioElement();
                if (audioElement && audioContext.state === "running") {
                    try {
                        // Check if audio is still valid before connecting
                        if (
                            !audioElement.ended &&
                            !audioElement.paused &&
                            audioElement.currentTime > 0
                        ) {
                            const source =
                                audioContext.createMediaElementSource(
                                    audioElement
                                );
                            source.connect(analyser);
                            analyser.connect(audioContext.destination);
                            return true;
                        }
                    } catch (e) {
                        console.warn(
                            "Could not connect to audio for lip sync:",
                            e
                        );
                    }
                }
                return false;
            };

            // Analyze audio and sync mouth movements
            const analyzeAudio = () => {
                if (!isSpeaking) return;

                // Check if there's still active audio playing
                const activeAudio = findAudioElement();
                if (!activeAudio) {
                    // No active audio found, stop the animation
                    console.log(
                        "🎭 No active audio found, stopping lip sync animation"
                    );
                    setMouthOpen(0);
                    setHeadTilt(0);
                    setEyeBlink(0);
                    return;
                }

                analyser.getByteFrequencyData(dataArray);

                // Calculate average volume from frequency data
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    sum += dataArray[i];
                }
                const average = sum / dataArray.length;
                const volume = average / 255; // Normalize to 0-1

                // Map volume to mouth opening (0-1)
                const mouthValue = Math.min(1, volume * 2); // Amplify for better visibility
                setMouthOpen(mouthValue);

                // Add subtle head tilt based on volume
                const headTiltValue = (volume - 0.5) * 0.1;
                setHeadTilt(headTiltValue);

                // Occasional eye blinks
                const blinkChance = Math.random();
                if (blinkChance > 0.985) {
                    setEyeBlink(1);
                    setTimeout(() => setEyeBlink(0), 120);
                }

                // Continue analyzing
                if (isSpeaking) {
                    requestAnimationFrame(analyzeAudio);
                }
            };

            // Start the lip sync process
            const startLipSync = async () => {
                // Don't start if not speaking
                if (!isSpeaking) return;

                try {
                    if (audioContext.state === "suspended") {
                        await audioContext.resume();
                    }

                    // Try to connect to audio immediately
                    if (connectToAudio()) {
                        console.log(
                            "🎭 Starting real-time lip sync with audio analysis"
                        );
                        analyzeAudio();
                    } else {
                        // If no audio found yet, wait a bit and try again
                        console.log("🎭 Waiting for audio to start...");
                        setTimeout(() => {
                            if (connectToAudio()) {
                                console.log(
                                    "🎭 Connected to audio, starting lip sync"
                                );
                                analyzeAudio();
                            } else {
                                // Fallback to basic animation if audio analysis fails
                                console.log(
                                    "Using fallback lip sync animation"
                                );
                                const fallbackInterval = setInterval(() => {
                                    if (!isSpeaking) {
                                        clearInterval(fallbackInterval);
                                        setMouthOpen(0);
                                        console.log(
                                            "🎭 Stopped fallback animation"
                                        );
                                        return;
                                    }
                                    const time = Date.now() * 0.005;
                                    const mouthValue = Math.max(
                                        0,
                                        Math.min(
                                            1,
                                            Math.sin(time) * 0.4 +
                                                0.5 +
                                                Math.sin(time * 2) * 0.2
                                        )
                                    );
                                    setMouthOpen(mouthValue);
                                }, 80);
                            }
                        }, 500);
                    }
                } catch (error) {
                    console.warn(
                        "Audio analysis failed, using fallback:",
                        error
                    );
                    // Fallback animation
                    const fallbackInterval = setInterval(() => {
                        if (!isSpeaking) {
                            clearInterval(fallbackInterval);
                            setMouthOpen(0);
                            return;
                        }
                        const time = Date.now() * 0.005;
                        const mouthValue = Math.max(
                            0,
                            Math.min(
                                1,
                                Math.sin(time) * 0.4 +
                                    0.5 +
                                    Math.sin(time * 2) * 0.2
                            )
                        );
                        setMouthOpen(mouthValue);
                    }, 80);
                }
            };

            startLipSync();

            // Cleanup
            return () => {
                if (audioContext.state !== "closed") {
                    audioContext.close();
                }
            };
        }, [isSpeaking]);

        // Apply mouth animation to avatar (if morph targets exist)
        React.useEffect(() => {
            if (scene) {
                scene.traverse((child) => {
                    if (
                        child instanceof THREE.Mesh &&
                        (child as THREE.Mesh).morphTargetDictionary
                    ) {
                        const mesh = child as THREE.Mesh;

                        // Look for mouth/jaw-related morph targets with various naming conventions
                        const mouthTargets = Object.keys(
                            mesh.morphTargetDictionary!
                        ).filter((key) => {
                            const lowerKey = key.toLowerCase();
                            return (
                                lowerKey.includes("mouth") ||
                                lowerKey.includes("jaw") ||
                                lowerKey.includes("lip") ||
                                lowerKey.includes("open") ||
                                lowerKey.includes("smile") ||
                                lowerKey.includes("talk") ||
                                lowerKey.includes("phoneme")
                            );
                        });

                        if (
                            mouthTargets.length > 0 &&
                            mesh.morphTargetInfluences
                        ) {
                            // Animate multiple morph targets for more realistic lip sync
                            mouthTargets.forEach((targetName) => {
                                const targetIndex =
                                    mesh.morphTargetDictionary![targetName];
                                if (targetIndex !== undefined) {
                                    // Different targets get different intensities
                                    let intensity = mouthOpen * 0.8;
                                    if (
                                        targetName
                                            .toLowerCase()
                                            .includes("wide") ||
                                        targetName
                                            .toLowerCase()
                                            .includes("open")
                                    ) {
                                        intensity = mouthOpen * 1.0; // Wide open mouth
                                    } else if (
                                        targetName
                                            .toLowerCase()
                                            .includes("narrow") ||
                                        targetName
                                            .toLowerCase()
                                            .includes("closed")
                                    ) {
                                        intensity = mouthOpen * 0.3; // Narrow mouth
                                    }

                                    mesh.morphTargetInfluences![targetIndex] =
                                        intensity;
                                }
                            });
                        } else if (
                            mesh.morphTargetInfluences &&
                            mesh.morphTargetInfluences.length > 0
                        ) {
                            // If no specific mouth targets found, animate the first available morph target
                            // This provides basic animation even without specific mouth morphs
                            const firstTargetIndex = 0;
                            mesh.morphTargetInfluences![firstTargetIndex] =
                                mouthOpen * 0.5;
                        }

                        // Look for eye-related morph targets for blinking
                        const eyeTargets = Object.keys(
                            mesh.morphTargetDictionary!
                        ).filter((key) => {
                            const lowerKey = key.toLowerCase();
                            return (
                                lowerKey.includes("eye") ||
                                lowerKey.includes("blink") ||
                                lowerKey.includes("lid")
                            );
                        });

                        if (
                            eyeTargets.length > 0 &&
                            mesh.morphTargetInfluences
                        ) {
                            eyeTargets.forEach((targetName) => {
                                const targetIndex =
                                    mesh.morphTargetDictionary![targetName];
                                if (targetIndex !== undefined) {
                                    mesh.morphTargetInfluences![targetIndex] =
                                        eyeBlink;
                                }
                            });
                        }

                        // Look for head/neck morph targets for subtle head tilt
                        const headTargets = Object.keys(
                            mesh.morphTargetDictionary!
                        ).filter((key) => {
                            const lowerKey = key.toLowerCase();
                            return (
                                lowerKey.includes("head") ||
                                lowerKey.includes("neck") ||
                                lowerKey.includes("tilt")
                            );
                        });

                        if (
                            headTargets.length > 0 &&
                            mesh.morphTargetInfluences
                        ) {
                            headTargets.forEach((targetName) => {
                                const targetIndex =
                                    mesh.morphTargetDictionary![targetName];
                                if (targetIndex !== undefined) {
                                    mesh.morphTargetInfluences![targetIndex] =
                                        headTilt;
                                }
                            });
                        }
                    }
                });
            }
        }, [scene, mouthOpen, headTilt, eyeBlink]);

        // Apply final position adjustment
        React.useEffect(() => {
            if (scene) {
                console.log("🎭 FINAL POSITION - Before:", scene.position);
                scene.position.set(0, 0.5, 0);
                scene.scale.setScalar(1.6);
                scene.updateMatrix();
                scene.updateMatrixWorld(true);
                console.log("🎭 FINAL POSITION - After:", scene.position);
            }
        }, [scene]);

        return (
            <group ref={ref}>
                <primitive object={scene} />
            </group>
        );
    }
);

LipSyncAvatar.displayName = "LipSyncAvatar";

interface AvatarDisplayProps {
    avatarUrl?: string;
    className?: string;
    isSpeaking?: boolean;
}

const AvatarDisplay: React.FC<AvatarDisplayProps> = ({
    avatarUrl,
    className = "w-full h-full",
    isSpeaking = false,
}) => {
    // Use your local Ready Player Me avatar
    const defaultAvatarUrl = avatarUrl || "/interviewer-avatar.glb"; // Your local RPM avatar (served from public folder)

    console.log("Loading avatar from:", defaultAvatarUrl);

    // Alternative: CDN URL if needed
    // "https://d1a370nemizbjq.cloudfront.net/68b88e056e93b8842f1afadf.glb";

    return (
        <div className={`${className} rounded-lg bg-transparent`}>
            <Canvas
                camera={{
                    position: [0, 1.5, 3.0],
                    fov: 70,
                }}
                gl={{
                    antialias: true,
                    alpha: true,
                }}
                style={{ background: "transparent" }}
            >
                {/* Lighting setup for white background */}
                <ambientLight intensity={1.0} />
                <directionalLight
                    position={[5, 5, 5]}
                    intensity={1.0}
                    castShadow
                />
                <directionalLight position={[-5, -5, -5]} intensity={0.5} />
                <pointLight position={[0, 2, 2]} intensity={0.4} />

                {/* Avatar model with suspense for loading */}
                <Suspense
                    fallback={
                        <mesh>
                            <boxGeometry args={[1, 1, 1]} />
                            <meshStandardMaterial color="gray" />
                        </mesh>
                    }
                >
                    <AvatarModel
                        avatarUrl={defaultAvatarUrl}
                        isSpeaking={isSpeaking}
                    />
                </Suspense>

                {/* Camera controls disabled - only dragging allowed */}
                <OrbitControls
                    enablePan={false}
                    enableZoom={false}
                    enableRotate={false}
                />
            </Canvas>
        </div>
    );
};

export default AvatarDisplay;
