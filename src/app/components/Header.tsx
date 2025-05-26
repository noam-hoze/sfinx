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
                backgroundColor: "rgb(80 60 179)",
                padding: "0 100px 0 0",
                height: "120px",
                boxSizing: "border-box",
            }}
        >
            {/* Using a standard img tag */}
            <img
                src="/logo-no-back.png" // Make sure this path is correct in your public folder
                alt="SFINX Logo"
                style={{
                    transform: "scale(0.25)",
                    transformOrigin: "left",
                    margin: "0 0 0 61px",
                }}
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
