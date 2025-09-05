# Sfinx Demo UI Design Document (Updated)

Target aesthetic: **Apple-like — smooth, sleek, elegant, minimal, advanced.**  
This update integrates **Learning Capability telemetry** and a new **AI Interviewer Session screen** into the candidate flow.

---

## Design Principles

-   **Minimalism:** no clutter, generous whitespace.
-   **Elegance:** rounded corners, soft shadows, balanced typography.
-   **Consistency:** unified palette, typography, iconography.
-   **Smoothness:** subtle transitions (fade, slide, expand).
-   **Story-first:** UI guides narrative: Work → Story → Growth → Employer Decision.

---

## Color & Typography

-   **Palette**

    -   Background: Soft white (#FAFAFA)
    -   Primary: Deep slate (#1C1C1E)
    -   Accent: Electric blue (#007AFF)
    -   Secondary: Light gray (#E5E5EA)
    -   Success: Green (#34C759)
    -   Warning: Yellow (#FFCC00)
    -   Risk: Red (#FF3B30)

-   **Typography**
    -   Headlines: **SF Pro Display Bold**
    -   Body: **SF Pro Text Regular**
    -   Sizes: XL section titles, Base body, Small metadata.

---

## Telemetries (Core Signals)

-   **Iteration Speed** – time between edits → test runs.
-   **Debug Loops** – failed → fixed test cycles.
-   **Refactor & Cleanups** – improvements to code structure.
-   **AI Assist Usage** – ratio of pasted vs. typed code.
-   **Focus & Idle Time** – effort distribution.
-   **Learning Capability** _(new)_:
    -   **Info-Seeking Events** – visits to YouTube, docs, ChatGPT, Cursor.
    -   **Assimilation** – whether new info is applied in code.
    -   **Latency** – time from search to working solution.
    -   **Reflection** – comments/explanations showing understanding.

---

## Screens

### 1. AI Interviewer Session _(new)_

-   **Purpose:** Simulate a live, interactive interview where an AI agent asks questions and can apply changes to the candidate’s code.
-   **Layout (Cursor-like interface):**
    -   **Left Panel:** File explorer.
    -   **Middle Panel:** Tabbed code editor (Monaco). Can be split to show a live preview pane.
    -   **Right Panel:** AI chat sidebar.
    -   **Bottom Panel:** Integrated terminal.
-   **Workflow:**
    -   Candidate receives task from AI interviewer.
    -   Candidate writes code in IDE.
    -   Candidate can also type a request in sidebar (_"Help with API integration"_).
    -   AI applies edit → editor flashes red (deletion) and green (addition).
    -   Candidate accepts → code updates.
-   **Style:** A professional, multi-pane IDE layout similar to Cursor. Clean, minimal, and functional.
-   **For demo:** Use prerecorded scripts but make it feel interactive.

### 2. Candidate Session

-   **Layout:** Left = recorded video. Right = telemetry graphs.
-   **Telemetry panel:** now includes _Learning Velocity_ (search → apply graph).
-   **Banner:** “Learning Mode Active” appears when candidate leaves IDE.
-   **Style:** calm, focus on process and evidence.

### 3. Candidate Profile Story (CPS)

-   **Header:** Candidate avatar, MatchScore %, Confidence.
-   **JD Alignment list:** React role requirements → green/yellow/red.
-   **Evidence Reel:** Thumbnails of clips (coding, debugging, learning moments).
-   **Workstyle Graphs:** iteration, debug, refactor, AI usage, **learning efficiency**.
-   **Fairness Flags:** highlight if candidate leaned heavily on AI without assimilation.

### 4. Continuous Improvement Profile (CIP)

-   **Header:** Candidate name, role.
-   **Main panel:** Radar chart includes a **Learning Capability spoke**.
-   **Trend line graph:** shows improvement in _learning velocity_ over sessions.
-   **Latest sessions:** list includes “Learning Moment” tags (e.g., “Solved after YouTube search”).
-   **Improve Gap button:** if a gap is in learning efficiency, task might prompt candidate to solve something by researching first.

### 5. Employer Console

-   **Main grid:** Candidate cards ranked with Fit %, Confidence, Trajectory.
-   **Heatmap:** React JD vs. skills; includes **Learning Capability row**.
-   **Snapshots:** Evidence of learning (e.g., “Candidate B searched for useContext, applied within 2 mins”).
-   **Fairness Flags:** highlight AI reliance vs. genuine learning.

---

## Animations & Transitions

-   **AI Interviewer:** chat bubbles appear with typewriter effect.
-   **Diff edits:** Monaco DiffEditor shows red/green diff before apply.
-   **Learning telemetry:** graph animates from “search” blip → line to “apply.”
-   **CPS:** MatchScore % counts up; learning efficiency bar fills smoothly.
-   **CIP:** radar spoke for learning glows when improved.
-   **Employer console:** heatmap row for Learning Capability animates into place.

---

## Tone & Emotion

-   **AI Interviewer Session:** futuristic, interactive, human-like dialogue.
-   **Candidate Session:** curiosity + flow.
-   **CPS:** clarity + proof.
-   **CIP:** empowerment + growth.
-   **Employer Console:** confidence + trust.

---

## Core Libraries (for implementation)

-   **Layout:** `react-resizable-panels` for the draggable, split-screen view.
-   **Editor:** `@monaco-editor/react` to embed the VS Code editor with diff support.
-   **UI Components:** `shadcn/ui` for building the chat panel and other UI elements, leveraging Tailwind CSS for an "Apple-like" aesthetic.
-   **Animations:** `react-type-animation` for the AI interviewer's typewriter effect.
-   **Icons:** `lucide-react` for minimal, clean iconography.

---

## Assets Needed

-   **Session videos**: show one candidate learning well (B), one misusing AI (C).
-   **Icons:** Book/search for learning events, AI robot for interviewer.
-   **Graphs:** radar with learning spoke, line chart of search→apply latency.
-   **Fairness Flag asset:** AI-heavy warning badge.

---

## Closing Visual

Employer Console with **3 candidates side by side**:

-   A: Fast, strong, minimal learning needs.
-   B: Slower but learns quickly (green learning row).
-   C: Relies on AI, flagged for weak assimilation (red learning row).

Investor takeaway: _“Sfinx doesn’t just score what candidates know — it reveals how fast they can learn, and it can interview them interactively with AI.”_
