import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
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
            },
            fontFamily: {
                sans: ['"SF Pro Display"', "sans-serif"],
                body: ['"SF Pro Text"', "sans-serif"],
            },
        },
    },
    plugins: [],
};
export default config;
