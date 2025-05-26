import GestureRecognizer from "./components/GestureRecognizer";

export default function Home() {
    return (
        <main
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "100vh",
            }}
        >
            <GestureRecognizer />
        </main>
    );
}
