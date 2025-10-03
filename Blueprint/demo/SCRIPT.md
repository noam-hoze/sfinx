# Sfinx Demo Recording Package

This demo shows how three candidates (A, B, C) perform the **same task** differently.
It highlights how Sfinx captures differences in working style, learning capability, and reliability.

---

## Candidate A – The Star

### Task 1 – Build From Scratch

**Requirement:**  
_"Build a React component called `UserList` that fetches users from  
`https://jsonplaceholder.typicode.com/users` and displays their name and email in a styled list."_

**Actions (Recording Script):**

-   Opens editor confidently, creates `UserList.jsx`.
-   Sets up `useState` + `useEffect` immediately.
-   Fetches API, parses JSON, maps over users.
-   Adds loading/error states gracefully.
-   Styles list neatly with spacing and font.
-   Runs → works on first try.

---

## Candidate B – The Learner

### Task 1 – Build From Scratch

**Requirement:**
_"Build a React component called `UserList` that fetches users from
`https://jsonplaceholder.typicode.com/users` and displays their name and email in a styled list."_

**Actions (Recording Script):**

-   Hesitates, googles _“React fetch data useEffect example.”_
-   Copies snippet, adjusts endpoint.
-   Misuses dependency array → bug on first run.
-   Debugs with `console.log`, reads error carefully.
-   After trial and error, fixes bug.
-   Final render works, but code messy/indented poorly.

---

## Candidate C – The Heavy AI User

### Task 1 – Build From Scratch

**Requirement:**
_"Build a React component called `UserList` that fetches users from
`https://jsonplaceholder.typicode.com/users` and displays their name and email in a styled list."_

**Actions (Recording Script):**

-   Opens ChatGPT/Cursor: _“React fetch data component list users.”_
-   Pastes large block of code directly.
-   Runs app → crashes, no reasoning.
-   Waits idle, pastes a second block.
-   Finally renders list, but with unused vars, no styling.
-   Never explains why it works.

---
