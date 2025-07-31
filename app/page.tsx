import { Conversation } from "./components/conversation";
import type { Metadata } from "next";

// Enhanced metadata for the home page
export const metadata: Metadata = {
    title: "AI Interview Platform - Sfinx",
    description: "Experience the future of interviews with our AI-powered platform featuring real-time conversation and advanced video analysis",
    openGraph: {
        title: "AI Interview Platform - Sfinx",
        description: "Experience the future of interviews with our AI-powered platform featuring real-time conversation and advanced video analysis",
    },
};

// Constants for better maintainability
const PAGE_TITLE = "Vayyar" as const;
const PAGE_SUBTITLE = "Full-Stack Developer" as const;

export default function Home() {
    return (
        <div className="relative">
            {/* Background gradient for visual appeal */}
            <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900 -z-10" />
            
            <main className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-12 bg-transparent text-white">
                {/* Header section */}
                <header className="text-center mb-8 sm:mb-12">
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-2 text-center bg-gradient-to-r from-white via-gray-200 to-white bg-clip-text text-transparent">
                        {PAGE_TITLE}
                    </h1>
                    <h2 className="text-lg sm:text-xl lg:text-2xl text-center mb-4 sm:mb-8 text-gray-300 font-medium">
                        {PAGE_SUBTITLE}
                    </h2>
                    <div className="w-16 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 mx-auto" />
                </header>

                {/* Main conversation component */}
                <section className="w-full max-w-6xl mx-auto" aria-label="Interview conversation interface">
                    <Conversation />
                </section>

                {/* Footer section */}
                <footer className="mt-8 sm:mt-12 text-center">
                    <p className="text-xs sm:text-sm text-gray-400 max-w-md mx-auto">
                        Powered by advanced AI technology for seamless interview experiences
                    </p>
                </footer>
            </main>
        </div>
    );
}
