# Quickstart: Background Confidence Gate

1. Set `NEXT_PUBLIC_DEBUG_MODE` true/false.
2. Update the interviewer prompt to emit a hidden CONTROL JSON line after each candidate answer:
   - CONTROL: {"overallConfidence":number,"pillars":{"adaptability":number,"creativity":number,"reasoning":number},"readyToProceed":boolean}
3. Ensure chat layer parses CONTROL lines, updates store (confidence, pillars, question count), and gates progression (≥95% and ≥3 questions → set stage="coding").
4. With DEBUG_MODE=true, show stage + confidence badge to staff only.
5. Validate: run a session; verify CONTROL parsed, store updated, advance at threshold, and no rubric/confidences are spoken.
