# Dynamic Evidence Captions Plan
## Goal
Ensure that when a user clicks on a specific evidence link (e.g., "Adaptability"), the video player displays the specific caption for that trait (e.g., "Adaptability: Candidate showed flexibility...") instead of a generic or combined caption.
## Constraints
- **Frontend Only**: No changes to the backend or database.
- **No Fallbacks**: Avoid implicit fallbacks; explicit logic only.
- **Performance**: Instant caption update upon clicking.
## Implementation Steps
### 1. Modify [app/(features)/cps/page.tsx](file:///Users/noonejoze/Projects/sfinx/app/%28features%29/cps/page.tsx)
**Current State**: 
- Passes `activeSession.videoChapters` directly to [EvidenceReel](file:///Users/noonejoze/Projects/sfinx/app/%28features%29/cps/components/EvidenceReel.tsx#19-152).
- `activeEvidenceKey` is available in Redux but not used for caption logic.
**Proposed Change**:
1.  **Select State**: Import `useSelector` and get `activeEvidenceKey` from Redux.
2.  **Process Chapters**:
    -   Create a `processedChapters` memoized value.
    -   If `activeEvidenceKey` is present:
        -   Parse it to extract `timestamp` and `evaluation` text.
        -   Map over `activeSession.videoChapters`.
        -   If a chapter covers the evidence timestamp:
            -   Clone the chapter.
            -   **Override** its `captions` array with a single new caption containing the specific `evaluation` text.
            -   Set the caption start/end time to match the evidence context (e.g., 10s window).
    -   If no `activeEvidenceKey`, return original chapters.
3.  **Pass to Player**: Pass `processedChapters` to the [EvidenceReel](file:///Users/noonejoze/Projects/sfinx/app/%28features%29/cps/components/EvidenceReel.tsx#19-152) component instead of the raw chapters.
### 2. Verify [EvidenceReel.tsx](file:///Users/noonejoze/Projects/sfinx/app/%28features%29/cps/components/EvidenceReel.tsx)
-   Confirm that [EvidenceReel](file:///Users/noonejoze/Projects/sfinx/app/%28features%29/cps/components/EvidenceReel.tsx#19-152) updates its VTT track when the `chapters` prop changes. (Verified: It uses `useMemo` on `chapters` to generate the blob URL).
## Verification
-   **Click Test**: Click "Adaptability" -> Video jumps -> Caption reads "Adaptability: ...".
-   **Switch Test**: Click "Creativity" (same time) -> Caption updates to "Creativity: ...".
-   **Clear Test**: Click away or clear selection -> Captions revert to original (if any).
