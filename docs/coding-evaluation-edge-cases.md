# Coding Evaluation Edge Cases & TODOs

## Overview
This document tracks edge cases and unresolved issues in the coding evaluation system that need to be addressed.

---

## 1. Paste Accountability - Unanswered Follow-up Questions

### Problem
When a candidate pastes code:
1. AI asks a follow-up question to evaluate understanding
2. Candidate may **submit the interview without answering**
3. Currently unclear what happens to the paste evaluation

### Questions to Answer
- Does the paste get stored in the database without an evaluation?
- Is the accountability score set to a default value (0? null?)?
- Does this affect the final independence score calculation?
- Should we block submission until pending paste questions are answered?
- Should we auto-evaluate as "no understanding" if left unanswered?

### Potential Solutions
1. **Block submission** - Don't allow submit until all paste follow-ups are answered
2. **Default to zero** - Treat unanswered as `understanding: "none"` and `accountabilityScore: 0`
3. **Skip in metrics** - Don't count unanswered pastes in the final evaluation
4. **Warn user** - Show a warning: "You have unanswered questions about pasted code"

### Recommended Approach
TBD

---

## 2. Independence Score - Paste Volume vs Written Code

### Problem
Independence score doesn't account for **how much of the final code was pasted** vs written by the candidate.

### Current State
We send to OpenAI:
- Total number of pastes
- Average accountability score (from previous evaluations)
- Count of poor understanding instances

### Missing Data
- **Percentage of final code that came from pastes** (by line count or character count)
- **Which parts of final submission were pasted** vs written
- **Ratio**: pasted code / total code

### Impact
A candidate who pastes 95% of their solution gets similar independence scoring as someone who pastes 5%, as long as they can explain it well.

### Solution Needed
Calculate and include paste volume metrics in the final evaluation.

---

## 3. [Add more edge cases as discovered]

### Problem
TBD

### Current State
TBD

### Solution Needed
TBD

---

## Notes
- Keep this document updated as new edge cases are discovered
- Mark items as RESOLVED when implemented
- Add date and implementation details when closing an item

