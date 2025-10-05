## **Frontend Developer Interview**

### **Interview Questions**

* Tell me about a complex React integration you built — what made it challenging?
* How do you handle communication between a parent app and embedded content (e.g., iframe or worker)?
* How do you ensure data sent between contexts is secure and validated?
* How do you debug client-side issues that only occur in production?
* How do you measure and improve frontend performance?
* What’s your approach to managing global state efficiently?
* Describe a time you optimized rendering in a large React app.

---

## **Coding Challenge**

**Prompt:**
Create a React component where a simulated *child frame* (no real iframe, just a mocked event) sends analytics events to the parent app using `postMessage`.
The parent:

* Listens for these events
* Validates that they follow the schema
* Displays them in a list

You’ll get a minimal template, and then the expected full answer.

---

### 🧩 **Template (for candidate)**

```tsx
// App.tsx
// Task:
// 1. Listen for "analytics:event" messages sent via window.postMessage.
// 2. Only accept messages with { type: "analytics:event", name: string, ts: number }.
// 3. Display each valid event name in a list.
// 4. Clean up listeners on unmount.
// 5. (Bonus) Simulate sending an event when clicking a button.

import React, { useEffect, useState } from "react";

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
```

---

### ✅ **Full Answer (expected solution)**

```tsx
import React, { useEffect, useState } from "react";

export default function App() {
  const [events, setEvents] = useState<string[]>([]);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      // ✅ Step 1: Validate type
      if (e.data?.type !== "analytics:event") return;

      // ✅ Step 2: Validate schema
      if (typeof e.data.name !== "string" || typeof e.data.ts !== "number") return;

      // ✅ Step 3: Add to state
      setEvents(prev => [...prev, e.data.name]);
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
```

---

**Expected Behavior:**

* Clicking the button simulates an incoming message.
* The app listens for and validates events.
* The event name appears in the list.
* Cleanup is handled properly with `removeEventListener`.
