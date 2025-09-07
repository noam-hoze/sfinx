"use client";

import { MediaPlayer, MediaProvider, Track } from "@vidstack/react";
import {
    DefaultVideoLayout,
    defaultLayoutIcons,
} from "@vidstack/react/player/layouts/default";

// bring styles directly (no layout.tsx needed)
import "vidstack/player/styles/base.css";
import "vidstack/player/styles/default/theme.css";
import "vidstack/player/styles/default/layouts/video.css";

export default function Page() {
    return (
        <main style={{ maxWidth: 800, margin: "40px auto", padding: 20 }}>
            <h1 style={{ fontSize: 24, marginBottom: 20 }}>Vidstack v1 Demo</h1>

            <MediaPlayer
                className="vds-theme"
                src="https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
                streamType="on-demand"
                playsInline
                preload="metadata"
                crossOrigin="anonymous"
            >
                <MediaProvider />

                {/* Inline chapters track (no public file needed) */}
                <Track
                    kind="chapters"
                    src={URL.createObjectURL(
                        new Blob(
                            [
                                `WEBVTT

00:00.000 --> 00:05.000
Intro

00:05.000 --> 00:15.000
Funny Scene

00:15.000 --> 00:25.000
Ending
`,
                            ],
                            { type: "text/vtt" }
                        )
                    )}
                    default
                />

                {/* Vidstack UI */}
                <DefaultVideoLayout icons={defaultLayoutIcons} />
            </MediaPlayer>
        </main>
    );
}
