import { Conversation } from "./components/conversation";

export default function Home() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-12 bg-black text-white">
            <h1 className="text-4xl font-bold mb-8 text-center">
                Sfinx
            </h1>
            <Conversation />
        </main>
    );
}
