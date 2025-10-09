## 🎙️ **Design Document — Realtime Voice Interview (OpenAI WebSocket POC)**

### **Objective**

Replace ElevenLabs voice layer with **OpenAI Realtime Voice API**, maintaining the same interview logic:

-   Controlled server-side turns
-   Real-time bidirectional audio
-   Event-based state updates (e.g., AI-usage detection, follow-up prompts, completion)

---

### **System Overview**

**Actors**

-   **Candidate (human)** — speaks and codes in browser IDE.
-   **Carrie (AI interviewer)** — OpenAI Realtime Voice model.
-   **Sfinx Orchestrator (server)** — controls turn logic and injects instructions.
-   **Frontend Interview UI** — editor, microphone stream, event emitters.

**Transport**

-   Browser mic → WebSocket → **Server bridge** → OpenAI Realtime WS.
-   AI audio → same path reversed.

---

### **Architecture Diagram (conceptual)**

```
┌────────────────────────────────────┐
│          Frontend (Next.js)        │
│  ├─ IDE + Mic                      │
│  ├─ Event Emitters (paste/done)    │
│  └─ WebSocket Client               │
└──────────────┬─────────────────────┘
               │ JSON + audio frames
               ▼
┌────────────────────────────────────┐
│       Node WS Bridge (POC)         │
│  ├─ Maintains interview state      │
│  ├─ Forwards audio both ways       │
│  ├─ Injects response.create cmds   │
│  └─ Applies interview logic        │
└──────────────┬─────────────────────┘
               │ Realtime API (voice)
               ▼
┌────────────────────────────────────┐
│        OpenAI Realtime Voice       │
│   • gpt-4o-realtime-preview        │
│   • Responds via speech            │
└────────────────────────────────────┘
```

---

### **Session Lifecycle**

| Phase                            | Trigger             | Server Action                                        | AI Behavior                 | Notes                                    |
| -------------------------------- | ------------------- | ---------------------------------------------------- | --------------------------- | ---------------------------------------- |
| **1. Greeting**                  | Connection open     | `response.create` → greet + ask readiness            | Speaks greeting             | Controlled start, no auto speech from AI |
| **2. Ready acknowledged**        | User speech “ready” | `response.create` → explain role                     | Speaks role summary         |                                          |
| **3. Coding phase**              | Start signal        | state: `is_coding=true`                              | Silent unless spoken to     | Streaming audio continues                |
| **4. AI usage detection (mock)** | Paste burst event   | `response.create` → “Ask one about <ai_added_code>”  | Asks one question → silence | Reset `using_ai=false`                   |
| **5. Follow-up**                 | “I’m done” click    | `response.create` → “Ask one about <followup_delta>” | One follow-up → silence     | Locks until new edits                    |
| **6. Completion**                | Submit / timer      | `response.create` → closing line; `session.close`    | Ends gracefully             | Disconnect both sides                    |

---

### **State Management (Server-Side)**

**Session state object**

```json
{
    "is_coding": false,
    "using_ai": false,
    "followup_ready": false,
    "last_delta": ""
}
```

**Rules**

-   Only one active voice prompt at a time.
-   Rising-edge detection for `using_ai` and `followup_ready`.
-   Auto-reset after each `response.create`.

---

### **Data Exchange Types**

| Type                    | Direction            | Purpose                                       |
| ----------------------- | -------------------- | --------------------------------------------- |
| `audio/webm`            | Client → Server → AI | Candidate’s mic audio                         |
| `audio/pcm` (or base64) | AI → Server → Client | Carrie’s spoken output                        |
| `kb_update`             | Client → Server      | UI state updates (paste, done, submit)        |
| `response.create`       | Server → AI          | Inject instructions (questions, closing line) |
| `session.close`         | Server → AI          | Graceful termination                          |

---

### **Simplifications vs ElevenLabs**

-   No internal state machine inside AI.
-   No “hidden user messages.”
-   All timing and logic owned by the **server bridge**.
-   Deterministic, easily extensible.

---

### **Success Criteria (POC)**

✅ Single full interview cycle runs via OpenAI Realtime voice.
✅ Server fully controls when Carrie speaks.
✅ Paste (“AI use”) and Done events trigger one-off questions.
✅ Graceful disconnect after closing line.
