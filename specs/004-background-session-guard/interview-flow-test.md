### Integration Test: Background via voice → CONTROL non‑zero evidence (single WAV)

- Purpose: drive the real UI with a fake mic WAV and verify our state updates: projectsUsed 0→1 and pillars contain any non‑zero.
- Assumptions: WAV exists at `data/mock-voice/en_threejs_memory_leak.wav` (16‑bit PCM, 48kHz recommended).
- Launch (Playwright/Chromium):
  - Flags: `--use-fake-device-for-media-stream --use-file-for-fake-audio-capture=<abs path to wav>`
  - Grant microphone permission for the app origin.
- Steps:
  1) Navigate to interview page; click “Start Interview”.
  2) Wait for Carrie to greet; wait for the Background question to appear (pre‑written script question).
  3) Assert store.background.projectsUsed === 0 (read from window.__sfinxStore or API).
  4) Let the fake mic play the WAV answer: “I integrated Three.js… custom shaders… memory leaks.”
  5) Wait up to 5s for CONTROL evaluation to complete and update store.
  6) Log: the asked question, WAV path, and parsed CONTROL JSON (no secrets).
- Assertions:
  - store.background.projectsUsed === 1
  - At least one of {adaptability, creativity, reasoning} > 0


