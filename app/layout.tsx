export const dynamic = 'force-dynamic';

import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
// Vidstack CSS must be loaded BEFORE Tailwind/globals.css
import "vidstack/player/styles/base.css";
import "vidstack/player/styles/default/theme.css";
import "vidstack/player/styles/default/layouts/video.css";
import "./globals.css";
import { JobApplicationProvider, MuteProvider, DebugProvider, InterviewPreloadProvider } from "./shared/contexts";
import Providers from "./providers";
import Header from "./shared/components/Header";
import Footer from "./shared/components/Footer";
import Sidebar from "./shared/components/Sidebar";

export const metadata: Metadata = {
    title: "Sfinx",
    description: "Evidence-based hiring platform",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
            <body className={GeistSans.className} suppressHydrationWarning={true}>
                <Providers>
                    <InterviewPreloadProvider>
                        <DebugProvider>
                            <MuteProvider>
                                <JobApplicationProvider>
                                    <div className="flex min-h-screen" style={{ background: "var(--page-bg)" }}>
                                        <Sidebar />
                                        <div className="flex flex-col flex-1">
                                            <Header />
                                            <main className="flex-1">
                                                {children}
                                            </main>
                                            <Footer />
                                        </div>
                                    </div>
                                </JobApplicationProvider>
                            </MuteProvider>
                        </DebugProvider>
                    </InterviewPreloadProvider>
                </Providers>
            </body>
        </html>
    );
}
