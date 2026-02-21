import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: "class",
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
        "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                "soft-white": "#FAFAFA",
                "deep-slate": "#1C1C1E",
                "electric-blue": "#007AFF",
                "light-gray": "#E5E5EA",
                "success-green": "#34C759",
                "warning-yellow": "#FFCC00",
                "risk-red": "#FF3B30",
                "sfinx-purple": "var(--sfinx-purple)",
                "sfinx-purple-light": "var(--sfinx-purple-light)",
                "sfinx-purple-dark": "var(--sfinx-purple-dark)",
            },
            fontFamily: {
                sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
                mono: ["var(--font-geist-mono)", "monospace"],
                body: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
            },
            borderRadius: {
                squircle: "28px",
                "squircle-sm": "20px",
                "squircle-lg": "32px",
            },
        },
    },
    plugins: [],
};
export default config;
