import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { JobApplicationProvider } from "../lib";
import Providers from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "Sfinx Demo",
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
                    <JobApplicationProvider>{children}</JobApplicationProvider>
                </Providers>
            </body>
        </html>
    );
}
