# Sfinx Demo Recording Package

This demo shows how three candidates (A, B, C) perform the **same two tasks** differently.  
It highlights how Sfinx captures differences in working style, learning capability, and reliability.

---

## Candidate A – The Star

### Task 1 – Build From Scratch
**Requirement:**  
*"Build a React component called `UserList` that fetches users from  
`https://jsonplaceholder.typicode.com/users` and displays their name and email in a styled list."*

**Actions (Recording Script):**  
- Opens editor confidently, creates `UserList.jsx`.  
- Sets up `useState` + `useEffect` immediately.  
- Fetches API, parses JSON, maps over users.  
- Adds loading/error states gracefully.  
- Styles list neatly with spacing and font.  
- Runs → works on first try.  

### Task 2 – Debug a Bug
**Requirement:**  
*"You are given a React component with a failing test. The test expects a button click to update the counter, but it stays at 0. Fix the bug so that the test passes."*

Buggy code:
```jsx
function Counter() {
  let count = 0;

  function increment() {
    count++;
  }

  return (
    <div>
      <p>{count}</p>
      <button onClick={increment}>Add</button>
    </div>
  );
}
```


**Actions (Recording Script):**

* Reads code, instantly spots: `count` not stateful.
* Says: *“This should use useState.”*
* Implements `const [count, setCount] = useState(0)`.
* Updates `onClick` with `setCount(prev => prev + 1)`.
* Runs test → passes first try.
* Adds small explanatory comment.

---

## Candidate B – The Learner

### Task 1 – Build From Scratch

**Requirement:**
*"Build a React component called `UserList` that fetches users from
`https://jsonplaceholder.typicode.com/users` and displays their name and email in a styled list."*

**Actions (Recording Script):**

* Hesitates, googles *“React fetch data useEffect example.”*
* Copies snippet, adjusts endpoint.
* Misuses dependency array → bug on first run.
* Debugs with `console.log`, reads error carefully.
* After trial and error, fixes bug.
* Final render works, but code messy/indented poorly.

### Task 2 – Debug a Bug

**Requirement:**
*"You are given a React component with a failing test. The test expects a button click to update the counter, but it stays at 0. Fix the bug so that the test passes."*

Buggy code: *(same as Candidate A)*

**Actions (Recording Script):**

* Reads test failure: *“Expected 1 but got 0.”*
* Unsure, tries `count = count + 1`, still fails.
* Googles *“React counter not updating.”*
* Learns about `useState`, implements incorrectly first.
* After 2–3 tries, gets working solution.
* Leaves redundant console logs.

---

## Candidate C – The Heavy AI User

### Task 1 – Build From Scratch

**Requirement:**
*"Build a React component called `UserList` that fetches users from
`https://jsonplaceholder.typicode.com/users` and displays their name and email in a styled list."*

**Actions (Recording Script):**

* Opens ChatGPT/Cursor: *“React fetch data component list users.”*
* Pastes large block of code directly.
* Runs app → crashes, no reasoning.
* Waits idle, pastes a second block.
* Finally renders list, but with unused vars, no styling.
* Never explains why it works.

### Task 2 – Debug a Bug

**Requirement:**
*"You are given a React component with a failing test. The test expects a button click to update the counter, but it stays at 0. Fix the bug so that the test passes."*

Buggy code: *(same as Candidate A)*

**Actions (Recording Script):**

* Immediately asks AI: *“Fix React counter test fail.”*
* Pastes suggested code using `useState`.
* Test passes, but unused imports remain.
* Cannot explain why fix works.
* Long idle pauses between pastes.

---

