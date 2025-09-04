# AI Interviewer Screen Implementation Plan

This document outlines the steps to build the AI Interviewer screen, which features a multi-pane, Cursor-like interface.

## 1. Setup & Dependencies

-   [ ] Create the component directory: `app/components/ai-interviewer`
-   [ ] Create initial component files: `AIInterviewerSession.tsx`, `FileExplorerPanel.tsx`, `EditorPanel.tsx`, `ChatPanel.tsx`, `TerminalPanel.tsx`, `PreviewPanel.tsx`
-   [ ] Install core libraries: `pnpm add react-resizable-panels @monaco-editor/react react-type-animation lucide-react`
-   [ ] Install `shadcn/ui`: `pnpm dlx shadcn-ui@latest init`
-   [ ] Add necessary `shadcn/ui` components (e.g., Card, Input, Avatar, ScrollArea, Button)

## 2. Layout & Panel Structure

-   [ ] Implement the main four-pane layout in `AIInterviewerSession.tsx` using `react-resizable-panels`.
-   [ ] Create a placeholder for the `FileExplorerPanel` (Left).
-   [ ] Create a placeholder for the `TerminalPanel` (Bottom).
-   [ ] Create a placeholder for the `ChatPanel` (Right).
-   [ ] Implement the split-pane functionality for the `EditorPanel` and `PreviewPanel` (Middle).

## 3. Core Component Implementation

-   [ ] **Editor Panel:**
    -   [ ] Integrate the Monaco Editor into `EditorPanel.tsx`.
    -   [ ] Configure the editor for TypeScript/React with appropriate syntax highlighting.
    -   [ ] Implement the diff view for AI-applied edits.
-   [ ] **Chat Panel:**
    -   [ ] Build the chat message components using `shadcn/ui`.
    -   [ ] Implement the scroll area for the conversation history.
    -   [ ] Add an input field and send button for user replies.
-   [ ] **File Explorer Panel:**
    -   [ ] Create a basic, static file tree structure.

## 4. Interactivity & Mock Data

-   [ ] **Chat:**
    -   [ ] Create a mock script for the AI-candidate conversation.
    -   [ ] Use `react-type-animation` to display the AI's messages with a typewriter effect.
-   [ ] **Editor & Preview:**
    -   [ ] Set up a mechanism to reflect code changes from the editor into the live preview pane.
    -   [ ] Simulate the AI applying a code change (diff) based on the mock script.
-   [ ] **File Explorer:**
    -   [ ] Allow clicking a file to open its content in the `EditorPanel`.

## 5. Final Integration

-   [ ] Assemble all the implemented panels into the main `AIInterviewerSession.tsx` component.
-   [ ] Replace the current content of `app/page.tsx` with the `<AIInterviewerSession />` component to display the new screen.
-   [ ] Refine styles and ensure the layout is responsive and matches the "Apple-like" aesthetic.
