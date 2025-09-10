import type { Metadata } from "next";
import { Inter } from "next/font/google";
// Vidstack CSS must be loaded BEFORE Tailwind/globals.css
import "vidstack/player/styles/base.css";
import "vidstack/player/styles/default/theme.css";
import "vidstack/player/styles/default/layouts/video.css";
import "./globals.css";
import { JobApplicationProvider } from "../lib";
import Providers from "./providers";
import Header from "../lib/components/Header";

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
                    <JobApplicationProvider>
                        <Header />
                        {children}
                    </JobApplicationProvider>
                </Providers>
            </body>
        </html>
    );
}
