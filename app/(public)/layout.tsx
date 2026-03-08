import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
    title: "Interview Guide | Sfinx",
    description: "Learn about the hiring process and how to prepare for your interview.",
};

export default function PublicLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body suppressHydrationWarning={true}>
                {children}
            </body>
        </html>
    );
}
