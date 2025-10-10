import React, { useEffect, useState } from "react";

export default function App() {
    const [events, setEvents] = useState<string[]>([]);

    useEffect(() => {
        const handleMessage = (e: MessageEvent) => {
            // ✅ Step 1: Validate type
            if (e.data?.type !== "analytics:event") return;

            // ✅ Step 2: Validate schema
            if (
                typeof e.data.name !== "string" ||
                typeof e.data.ts !== "number"
            )
                return;

            // ✅ Step 3: Add to state
            setEvents((prev) => [...prev, e.data.name]);
        };

        window.addEventListener("message", handleMessage);

        return () => window.removeEventListener("message", handleMessage);
    }, []);

    const sendMockEvent = () => {
        const event = {
            type: "analytics:event",
            name: "ButtonClicked",
            ts: Date.now(),
        };
        window.postMessage(event, "*");
    };

    return (
        <div style={{ padding: 20, fontFamily: "sans-serif" }}>
            <h2>Analytics Event Receiver</h2>
            <button onClick={sendMockEvent}>Simulate Event</button>
            <ul style={{ marginTop: 20 }}>
                {events.map((name, i) => (
                    <li key={i}>{name}</li>
                ))}
            </ul>
        </div>
    );
}
