import "./globals.css";
import type { Metadata, Viewport } from "next";

// Enhanced metadata for better SEO and performance
export const metadata: Metadata = {
    title: {
        default: "Sfinx - AI Interview Platform",
        template: "%s | Sfinx"
    },
    description: "Advanced AI-powered interview platform with real-time conversation and video analysis",
    keywords: ["AI interview", "video interview", "conversation AI", "ElevenLabs", "interview platform"],
    authors: [{ name: "Sfinx Team" }],
    creator: "Sfinx",
    metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'),
    openGraph: {
        type: "website",
        locale: "en_US",
        url: "./",
        title: "Sfinx - AI Interview Platform",
        description: "Advanced AI-powered interview platform with real-time conversation and video analysis",
        siteName: "Sfinx",
    },
    twitter: {
        card: "summary_large_image",
        title: "Sfinx - AI Interview Platform",
        description: "Advanced AI-powered interview platform with real-time conversation and video analysis",
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
        },
    },
    icons: {
        icon: "/icon.png",
        shortcut: "/icon.png",
        apple: "/icon.png",
    },
};

// Viewport configuration for better mobile experience
export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    themeColor: [
        { media: "(prefers-color-scheme: light)", color: "#ffffff" },
        { media: "(prefers-color-scheme: dark)", color: "#000000" },
    ],
};

// Props interface for better type safety
interface RootLayoutProps {
    children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
    return (
        <html 
            lang="en" 
            className="h-full bg-black text-white antialiased"
            suppressHydrationWarning
        >
            <head>
                {/* Preload critical resources */}
                <link rel="preconnect" href="https://api.elevenlabs.io" />
                <link rel="preconnect" href="https://placehold.co" />
                
                {/* DNS prefetch for performance */}
                <link rel="dns-prefetch" href="https://api.elevenlabs.io" />
                
                {/* Prevent FOUC (Flash of Unstyled Content) */}
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                            (function() {
                                try {
                                    document.documentElement.style.visibility = 'hidden';
                                    window.addEventListener('DOMContentLoaded', function() {
                                        document.documentElement.style.visibility = 'visible';
                                    });
                                } catch (e) {}
                            })();
                        `,
                    }}
                />
            </head>
            <body 
                className="h-full min-h-screen bg-black text-white font-sans"
                suppressHydrationWarning
            >
                <div id="root" className="h-full">
                    {children}
                </div>
                
                {/* Error boundary fallback for better UX */}
                <noscript>
                    <div className="fixed inset-0 flex items-center justify-center bg-black text-white text-center p-4">
                        <div>
                            <h1 className="text-2xl font-bold mb-4">JavaScript Required</h1>
                            <p>This application requires JavaScript to function properly. Please enable JavaScript in your browser.</p>
                        </div>
                    </div>
                </noscript>
            </body>
        </html>
    );
}
