export const dynamic = 'force-dynamic';

import type { Metadata } from "next";
import { Inter } from "next/font/google";
// Vidstack CSS must be loaded BEFORE Tailwind/globals.css
import "vidstack/player/styles/base.css";
import "vidstack/player/styles/default/theme.css";
import "vidstack/player/styles/default/layouts/video.css";
import "./globals.css";
import { JobApplicationProvider, MuteProvider } from "./shared/contexts";
import Providers from "./providers";
import Header from "./shared/components/Header";
import Footer from "./shared/components/Footer";

const inter = Inter({ subsets: ["latin"] });

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
        <html lang="en">
            <body className={inter.className} suppressHydrationWarning={true}>
                <Providers>
                    <MuteProvider>
                        <JobApplicationProvider>
                            <div className="flex flex-col min-h-screen">
                                <Header />
                                <main className="flex-1">
                                    {children}
                                </main>
                                <Footer />
                            </div>
                        </JobApplicationProvider>
                    </MuteProvider>
                </Providers>
            </body>
        </html>
    );
}
