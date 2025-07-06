import { Conversation } from "./components/conversation";

export default function Home() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-12 bg-black text-white">
            <h1 className="text-4xl font-bold mb-2 text-center">Vayyar</h1>
            <h2 className="text-2xl text-center mb-8">Full-Stack Developer</h2>
            <Conversation />
        </main>
    );
}
