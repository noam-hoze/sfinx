# Sfinx Demo Guide (Sept 10, 2025)

This demo shows how Sfinx transforms hiring by replacing traditional interviews with **evidence-based profiles** that update continuously.  
Investors will see the candidate journey and the employer view in three steps.

---

## Job Description (JD) for Demo

**Role:** Frontend Developer (React)

**Requirements:**

-   Proficiency in **React** and modern JavaScript (ES6+).
-   Ability to build **responsive UI components** with clean, maintainable code.
-   Experience with **state management** (hooks, context, or Redux).
-   Familiarity with **API integration** (REST/GraphQL).
-   Strong debugging and problem-solving skills.
-   Collaboration mindset and willingness to learn.

👉 This JD will be used in the demo to generate CPS (Candidate Profile Story) reports.

---

## 1. Candidate Session (Work Evidence)

-   Each candidate completes a **short coding/bug-fix task** in a React environment.
-   We show **3 recorded sessions**:
    1. **Candidate A:** Strong, fast, structured.
    2. **Candidate B:** Average, learns while coding, some struggles.
    3. **Candidate C:** Weak, slow, heavy AI reliance.
-   Alongside each video, Sfinx tracks **telemetries**.

### Telemetries

-   **Iteration Speed**

    -   What: Velocity of meaningful change cycles (edit → run/test → result).
    -   How we measure: Timestamps from saves/runs, compile/test outcomes, first-success time.
    -   Key signals: time-to-first-success, median/p95 cycle time, iterations per 10m.
    -   In demo: line chart + distribution; faster, consistent cycles score higher.

-   **Debug Loops**

    -   What: Sequences from failing state to passing state (problem isolation + fix).
    -   How we measure: Error/test status transitions, repeated attempts, revert/retry markers.
    -   Key signals: loops/hour, attempts per loop, fix rate, % stuck/abandoned loops.
    -   In demo: bar showing loop count and success rate with recent examples.

-   **Search & Learning Behavior**

    -   What: Information retrieval and hypothesis testing during problem solving.
    -   How we measure: Doc/IDE command palette opens, internal searches, external tab opens (counts + dwell; no content captured).
    -   Key signals: unique sources, lookups per 10m, average dwell, lookup→fix conversion.
    -   In demo: timeline tags for lookups + summary counts.

-   **Refactor & Cleanups**

    -   What: Structural/code-quality improvements beyond immediate correctness.
    -   How we measure: Diff heuristics (rename/extract, dead-code deletion, LOC/complexity deltas), lints resolved after pass state.
    -   Key signals: refactor events/session, net LOC reduction post-pass, complexity delta, lint fixes.
    -   In demo: before/after snippets and event count.

-   **AI Assist Usage**

    -   What: Transparent view of AI involvement vs. original work.
    -   How we measure: Prompt events, suggestion accepts/edits, paste vs. typed ratio, suggestion token size, provenance tags.
    -   Key signals: prompts/session, adoption rate, edit distance, % final code AI-originated.
    -   In demo: usage breakdown + tags on affected clips.

-   **Focus & Idle Time**
    -   What: Active engagement vs. stalled periods.
    -   How we measure: Keystrokes/cursor/file switches/runs; pauses > N seconds count as idle (no OS surveillance).
    -   Key signals: active %, long idle episodes, context switches/min, longest focus streak.
    -   In demo: focus gauge + idle segment overlays.

---

## 2. Candidate Profile Story (CPS)

The **CPS** converts a session into a digestible JD-match report.

### What CPS includes

-   **MatchScore** → % fit to the React JD.
-   **Confidence** → evidence strength (recency + diversity).
-   **Top 5 Gaps** → where candidate fell short.
-   **Evidence Reel** → timestamped clips proving behavior.
-   **Workstyle Graphs** → iteration, debugging, learning.
-   **AI Transparency** → tags for assist usage.

👉 CPS = _“Why this candidate fits the React role, with proof.”_

---

## 3. Continuous Improvement Profile (CIP)

The **CIP** shows growth over time.

### What CIP includes

-   **Skill Radar** → React skills mapped (UI, state, API, debug).
-   **Trend Lines** → progress curve across sessions.
-   **Latest Sessions** → most recent work evidence.
-   **Improve Gap Button** → targeted micro-task → instant update.
-   **Versioning** → frozen snapshot for fairness in hiring.

👉 CIP = _“Candidate isn’t static — they’re improving.”_

---

## 4. Employer Console

Employers see **insights, not raw video**.

### Employer view

-   **Ranked Shortlist** → sorted by Fit × Confidence × Trajectory.
-   **JD Alignment Heatmap** → visual of requirements vs. skills.
-   **CPS Snapshots** → quick JD MatchScores + clips.
-   **CIP Trajectories** → growth trend lines.
-   **Fairness Flags** → context for environment, AI us
