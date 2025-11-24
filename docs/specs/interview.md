# Interview Feature Spec

## Overview
- Unified interview flow covering background Q&A, completion, and coding IDE on a single page.
- Interview state managed through `interviewMachine` Redux slice and `interviewChatStore` stages.

## Completion to Coding Transition
- Completion branch dispatches the coding transition directly from `app/(features)/interview/page.tsx`.
- Coding entry sets company context, moves the machine state to `in_coding_session`, and updates the chat stage to `coding`.
- The page renders the coding IDE immediately whenever the machine state reaches `in_coding_session`.
