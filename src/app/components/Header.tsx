// import Image from "next/image"; // Remove Next.js Image import
import Switch from "./Switch";

interface HeaderProps {
    showHandData: boolean;
    toggleHandData: () => void;
}

const Header: React.FC<HeaderProps> = ({ showHandData, toggleHandData }) => {
    return (
        <header
            style={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: "#1a1a1a",
                padding: "0 100px 0 0"
            }}
        >
            {/* Using a standard img tag */}
            <img
                src="/logo-1.png" // Make sure this path is correct in your public folder
                alt="SFINX Logo"
                style={{ transform: "scale(0.5)" }}
            />
            <Switch
                isOn={showHandData}
                handleToggle={toggleHandData}
                label="Show Hand Data"
            />
        </header>
    );
};

export default Header;
