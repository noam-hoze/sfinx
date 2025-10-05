import React, { useEffect, useState } from "react";

// Task:
// 1. Listen for "analytics:event" messages sent via window.postMessage.
// 2. Only accept messages with { type: "analytics:event", name: string, ts: number }.
// 3. Display each valid event name in a list.
// 4. Clean up listeners on unmount.
// 5. (Bonus) Simulate sending an event when clicking a button.

export default function App() {
    const [events, setEvents] = useState<string[]>([]);

    // your code here

    return (
        <div style={{ padding: 20 }}>
            <h2>Analytics Event Receiver</h2>
            {/* add button and list here */}
        </div>
    );
}
