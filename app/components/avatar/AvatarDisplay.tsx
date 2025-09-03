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

            // Scale and position the avatar as if standing on the floor
            clonedScene.scale.setScalar(2.0);
            clonedScene.position.set(0, -4.5, 0);

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

            // Add a visible debug indicator
            const debugCube = new THREE.Mesh(
                new THREE.BoxGeometry(0.1, 0.1, 0.1),
                new THREE.MeshBasicMaterial({ color: 0xff0000 })
            );
            debugCube.position.set(0, 0, 1);
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

        // Enhanced lip sync animation with phoneme mapping
        React.useEffect(() => {
            if (!isSpeaking) {
                setMouthOpen(0);
                setHeadTilt(0);
                setEyeBlink(0);
                return;
            }

            // Phoneme patterns for different mouth shapes
            const phonemes = [
                { pattern: /[aeiouAEIOU]/g, intensity: 0.8 }, // Vowels - wide open
                { pattern: /[mM]/g, intensity: 0.9 }, // M - very closed
                { pattern: /[pPbBfFvV]/g, intensity: 0.2 }, // P/B/F/V - slightly open
                { pattern: /[tTdDkKgG]/g, intensity: 0.3 }, // T/D/K/G - medium open
                { pattern: /[sSzZ]/g, intensity: 0.1 }, // S/Z - tight
                { pattern: /[wW]/g, intensity: 0.4 }, // W - rounded
            ];

            // Create a more realistic mouth animation
            const animateMouth = () => {
                let charIndex = 0;
                const interval = setInterval(() => {
                    if (!isSpeaking) {
                        clearInterval(interval);
                        setMouthOpen(0);
                        return;
                    }

                    // Simulate speaking by cycling through different mouth positions
                    // This creates a more natural animation pattern
                    const time = Date.now() * 0.005;
                    let baseIntensity = Math.sin(time) * 0.3 + 0.5;

                    // Add some variation based on simulated phonemes
                    const variation = Math.sin(time * 2) * 0.2;
                    const mouthValue = Math.max(
                        0,
                        Math.min(1, baseIntensity + variation)
                    );

                    setMouthOpen(mouthValue);

                    // Add subtle head tilt animation
                    const headTiltValue = Math.sin(time * 0.3) * 0.05; // Very subtle
                    setHeadTilt(headTiltValue);

                    // Occasional eye blinks (less frequent)
                    const blinkChance = Math.random();
                    if (blinkChance > 0.98) {
                        setEyeBlink(1);
                        setTimeout(() => setEyeBlink(0), 150); // Quick blink
                    }
                }, 80); // Faster updates for smoother animation

                return () => clearInterval(interval);
            };

            const cleanup = animateMouth();
            return cleanup;
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
                scene.position.set(0, -4.5, 0);
                scene.scale.setScalar(2.0);
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
    className = "w-full h-96",
    isSpeaking = false,
}) => {
    // Use your local Ready Player Me avatar
    const defaultAvatarUrl = avatarUrl || "/interviewer-avatar.glb"; // Your local RPM avatar (served from public folder)

    console.log("Loading avatar from:", defaultAvatarUrl);

    // Alternative: CDN URL if needed
    // "https://d1a370nemizbjq.cloudfront.net/68b88e056e93b8842f1afadf.glb";

    return (
        <div
            className={`${className} rounded-lg overflow-hidden bg-transparent`}
        >
            <Canvas
                camera={{
                    position: [0, -1, 1.5],
                    fov: 50,
                }}
                gl={{
                    antialias: true,
                    alpha: true,
                }}
                style={{ background: "transparent" }}
            >
                {/* Lighting setup for white background */}
                <ambientLight intensity={0.8} />
                <directionalLight
                    position={[5, 5, 5]}
                    intensity={0.8}
                    castShadow
                />
                <directionalLight position={[-5, -5, -5]} intensity={0.4} />
                <pointLight position={[0, 2, 2]} intensity={0.3} />

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

                {/* Camera controls */}
                <OrbitControls
                    enablePan={true}
                    enableZoom={true}
                    enableRotate={true}
                    minDistance={1.5}
                    maxDistance={8}
                    minPolarAngle={Math.PI / 12}
                    maxPolarAngle={Math.PI - Math.PI / 12}
                    panSpeed={0.8}
                    rotateSpeed={0.5}
                />
            </Canvas>
        </div>
    );
};

export default AvatarDisplay;
