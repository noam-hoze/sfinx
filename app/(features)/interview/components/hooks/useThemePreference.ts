import { useEffect, useState } from "react";

export const useThemePreference = () => {
    const [isDarkMode, setIsDarkMode] = useState(false);

    useEffect(() => {
        const savedTheme = localStorage.getItem("sfinx-theme");
        const shouldBeDark = savedTheme === "dark";
        setIsDarkMode(shouldBeDark);

        const root = document.documentElement;
        if (shouldBeDark) {
            root.classList.add("dark");
        } else {
            root.classList.remove("dark");
        }
    }, []);

    return isDarkMode;
};
